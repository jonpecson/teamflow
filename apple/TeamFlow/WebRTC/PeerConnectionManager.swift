import Foundation
import LiveKitWebRTC
import Combine

@MainActor
final class PeerConnectionManager: ObservableObject {
    @Published var remoteVideoTracks: [String: RTCVideoTrack] = [:]
    @Published var localVideoTrack: RTCVideoTrack?

    private var peers: [String: PeerEntry] = [:]
    private var cancellables = Set<AnyCancellable>()
    private let meetingId: String
    private let username: String

    private struct PeerEntry {
        let client: WebRTCClient
        var polite: Bool
        var makingOffer: Bool = false
    }

    init(meetingId: String, username: String) {
        self.meetingId = meetingId
        self.username = username
        print("[WebRTC] PeerConnectionManager init for meeting \(meetingId)")

        WebSocketService.shared.messageReceived
            .receive(on: DispatchQueue.main)
            .sink { [weak self] msg in
                Task { @MainActor in
                    await self?.handleWS(msg)
                }
            }
            .store(in: &cancellables)
    }

    func createPeer(for remoteUser: String, initiator: Bool) {
        guard peers[remoteUser] == nil else {
            print("[WebRTC] Peer already exists for \(remoteUser)")
            return
        }
        let polite = !initiator
        print("[WebRTC] Creating peer for \(remoteUser), polite=\(polite)")

        let client = WebRTCClient()
        // Start audio immediately
        client.startAudio()
        peers[remoteUser] = PeerEntry(client: client, polite: polite)

        client.onIceCandidate = { [weak self] candidate in
            guard let self else { return }
            let data: [String: Any] = [
                "sdpMLineIndex": candidate.sdpMLineIndex,
                "sdpMid": candidate.sdpMid ?? "",
                "candidate": candidate.sdp,
            ]
            WebSocketService.shared.send(.rtcSignal(
                meetingId: self.meetingId,
                targetUser: remoteUser,
                signalType: "ice_candidate",
                data: data
            ))
        }

        client.onRemoteTrack = { [weak self] track in
            print("[WebRTC] Got remote \(track.kind) track from \(remoteUser)")
            if let videoTrack = track as? RTCVideoTrack {
                DispatchQueue.main.async {
                    self?.remoteVideoTracks[remoteUser] = videoTrack
                }
            }
        }

        client.onConnectionStateChange = { [weak self] state in
            print("[WebRTC] Connection state for \(remoteUser): \(state.rawValue)")
            if state == .disconnected || state == .failed {
                DispatchQueue.main.async {
                    self?.removePeer(remoteUser)
                }
            } else if state == .connected {
                print("[WebRTC] ✓ Connected to \(remoteUser)!")
            }
        }

        // If we're the initiator, onnegotiationneeded will fire after addTrack (from startAudio)
        // and automatically send the offer
        if initiator {
            Task {
                do {
                    let offer = try await client.createOffer()
                    print("[WebRTC] Sending offer to \(remoteUser)")
                    let sdpData: [String: Any] = ["type": "offer", "sdp": offer.sdp]
                    WebSocketService.shared.send(.rtcSignal(
                        meetingId: meetingId,
                        targetUser: remoteUser,
                        signalType: "offer",
                        data: sdpData
                    ))
                } catch {
                    print("[WebRTC] Failed to create offer for \(remoteUser): \(error)")
                }
            }
        }
    }

    func startLocalVideo() -> RTCVideoTrack? {
        // Start video on the first peer, then renegotiate all
        guard let (firstUser, firstEntry) = peers.first else { return nil }

        guard let track = firstEntry.client.startVideo() else {
            print("[WebRTC] Failed to start local video")
            return nil
        }
        localVideoTrack = track

        // Renegotiate with all peers to add the video track
        for (user, entry) in peers {
            Task {
                do {
                    // Start video on other peers too (adds track to their PC)
                    if user != firstUser {
                        _ = entry.client.startVideo()
                    }
                    let offer = try await entry.client.createOffer()
                    print("[WebRTC] Sending renegotiation offer to \(user) (video added)")
                    let sdpData: [String: Any] = ["type": "offer", "sdp": offer.sdp]
                    WebSocketService.shared.send(.rtcSignal(
                        meetingId: meetingId,
                        targetUser: user,
                        signalType: "offer",
                        data: sdpData
                    ))
                } catch {
                    print("[WebRTC] Renegotiation failed for \(user): \(error)")
                }
            }
        }
        return track
    }

    func stopLocalVideo() {
        for (_, entry) in peers {
            entry.client.stopVideo()
        }
        localVideoTrack = nil
    }

    func setAudioEnabled(_ enabled: Bool) {
        for (_, entry) in peers {
            entry.client.setAudioEnabled(enabled)
        }
    }

    func removePeer(_ username: String) {
        print("[WebRTC] Removing peer \(username)")
        peers[username]?.client.close()
        peers.removeValue(forKey: username)
        remoteVideoTracks.removeValue(forKey: username)
    }

    func cleanup() {
        print("[WebRTC] Cleaning up all peers")
        for (_, entry) in peers {
            entry.client.close()
        }
        peers.removeAll()
        remoteVideoTracks.removeAll()
        localVideoTrack = nil
        cancellables.removeAll()
    }

    private func handleWS(_ msg: ServerMessage) async {
        guard case .rtcSignal(let signal) = msg else { return }
        guard signal.meetingId == meetingId else { return }

        let fromUser = signal.fromUser
        let data = signal.data.value as? [String: Any] ?? [:]
        print("[WebRTC] Received \(signal.signalType) from \(fromUser)")

        switch signal.signalType {
        case "offer":
            var entry = peers[fromUser]
            if entry == nil {
                // Receiving unsolicited offer — we're polite
                createPeer(for: fromUser, initiator: false)
                entry = peers[fromUser]
            }
            guard let entry, let sdpString = data["sdp"] as? String else {
                print("[WebRTC] No SDP in offer from \(fromUser)")
                return
            }

            let client = entry.client
            let offerCollision = entry.makingOffer

            if !entry.polite && offerCollision {
                print("[WebRTC] Ignoring colliding offer from \(fromUser) (we're impolite)")
                return
            }

            do {
                let remoteSDP = RTCSessionDescription(type: .offer, sdp: sdpString)
                try await client.setRemoteDescription(remoteSDP)
                let answer = try await client.createAnswer()
                print("[WebRTC] Sending answer to \(fromUser)")
                let answerData: [String: Any] = ["type": "answer", "sdp": answer.sdp]
                WebSocketService.shared.send(.rtcSignal(
                    meetingId: meetingId,
                    targetUser: fromUser,
                    signalType: "answer",
                    data: answerData
                ))
            } catch {
                print("[WebRTC] Failed to handle offer from \(fromUser): \(error)")
            }

        case "answer":
            guard let entry = peers[fromUser],
                  let sdpString = data["sdp"] as? String else {
                print("[WebRTC] No entry/SDP for answer from \(fromUser)")
                return
            }
            do {
                let remoteSDP = RTCSessionDescription(type: .answer, sdp: sdpString)
                try await entry.client.setRemoteDescription(remoteSDP)
                print("[WebRTC] ✓ Answer set from \(fromUser)")
            } catch {
                print("[WebRTC] Failed to set answer from \(fromUser): \(error)")
            }

        case "ice_candidate":
            guard let entry = peers[fromUser],
                  let candidateStr = data["candidate"] as? String else { return }
            let sdpMid = data["sdpMid"] as? String
            let sdpMLineIndex = (data["sdpMLineIndex"] as? NSNumber)?.int32Value ?? 0
            let candidate = RTCIceCandidate(sdp: candidateStr, sdpMLineIndex: sdpMLineIndex, sdpMid: sdpMid)
            do {
                try await entry.client.addIceCandidate(candidate)
            } catch {
                // Early ICE candidate — ignore
            }

        default:
            break
        }
    }
}
