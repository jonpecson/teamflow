import Foundation
import Combine

@MainActor
final class CallViewModel: ObservableObject {
    @Published var activeCalls: [String: ActiveCall] = [:]
    @Published var currentMeetingId: String?
    @Published var callStartTime: Date?
    @Published var micEnabled = true
    @Published var cameraEnabled = false

    // WebRTC peer connections
    @Published var peerManager: PeerConnectionManager?

    private var cancellables = Set<AnyCancellable>()

    init() {
        WebSocketService.shared.messageReceived
            .sink { [weak self] msg in self?.handleWS(msg) }
            .store(in: &cancellables)
    }

    func loadActiveCalls() async {
        do {
            let calls = try await APIClient.shared.activeCalls()
            activeCalls = Dictionary(uniqueKeysWithValues: calls.map { ($0.meetingId, $0) })
        } catch {
            print("Failed to load active calls: \(error)")
        }
    }

    func startCall(channelId: String, channelName: String, username: String) async {
        do {
            let resp = try await APIClient.shared.startCall(channelId: channelId)
            let call = ActiveCall(
                meetingId: resp.meetingId, channelId: resp.channelId,
                channelName: channelName, startedBy: resp.startedBy,
                participants: [username], startedAt: ISO8601DateFormatter().string(from: Date())
            )
            activeCalls[resp.meetingId] = call
            currentMeetingId = resp.meetingId
            callStartTime = Date()

            // Start WebRTC
            startPeerManager(meetingId: resp.meetingId, username: username)
        } catch {
            print("Failed to start call: \(error)")
        }
    }

    func joinCall(meetingId: String) async {
        do {
            let _ = try await APIClient.shared.joinCall(meetingId)
            let calls = try await APIClient.shared.activeCalls()
            activeCalls = Dictionary(uniqueKeysWithValues: calls.map { ($0.meetingId, $0) })
            currentMeetingId = meetingId
            callStartTime = Date()

            let username = AuthService.shared.username
            startPeerManager(meetingId: meetingId, username: username)

            // Use deterministic role: alphabetically higher username initiates
            if let call = activeCalls[meetingId] {
                for participant in call.participants where participant != username {
                    let weInitiate = username > participant
                    peerManager?.createPeer(for: participant, initiator: weInitiate)
                }
            }
        } catch {
            print("Failed to join call: \(error)")
        }
    }

    func leaveCall() {
        guard let meetingId = currentMeetingId else { return }
        // Optimistic: cleanup UI first, then notify server
        peerManager?.cleanup()
        peerManager = nil

        let username = AuthService.shared.username
        if var call = activeCalls[meetingId] {
            call.participants.removeAll { $0 == username }
            activeCalls[meetingId] = call
        }
        currentMeetingId = nil
        callStartTime = nil
        cameraEnabled = false
        micEnabled = true
        Task { try? await APIClient.shared.leaveCall(meetingId) }
    }

    func endCall() {
        guard let meetingId = currentMeetingId else { return }
        peerManager?.cleanup()
        peerManager = nil

        activeCalls.removeValue(forKey: meetingId)
        currentMeetingId = nil
        callStartTime = nil
        cameraEnabled = false
        micEnabled = true
        Task { try? await APIClient.shared.endCall(meetingId) }
    }

    func toggleMic() {
        micEnabled.toggle()
        peerManager?.setAudioEnabled(micEnabled)
    }

    func toggleCamera() {
        cameraEnabled.toggle()
        if cameraEnabled {
            _ = peerManager?.startLocalVideo()
        } else {
            peerManager?.stopLocalVideo()
        }
    }

    var currentCall: ActiveCall? {
        guard let id = currentMeetingId else { return nil }
        return activeCalls[id]
    }

    func callForChannel(_ channelId: String) -> ActiveCall? {
        activeCalls.values.first { $0.channelId == channelId }
    }

    // MARK: - Private

    private func startPeerManager(meetingId: String, username: String) {
        peerManager?.cleanup()
        peerManager = PeerConnectionManager(meetingId: meetingId, username: username)
    }

    private func handleWS(_ msg: ServerMessage) {
        switch msg {
        case .callStarted(let p):
            // Deduplicate: don't add if already exists
            if activeCalls[p.meetingId] == nil {
                let call = ActiveCall(
                    meetingId: p.meetingId, channelId: p.channelId,
                    channelName: p.channelName, startedBy: p.startedBy,
                    participants: [p.startedBy], startedAt: ISO8601DateFormatter().string(from: Date())
                )
                activeCalls[p.meetingId] = call
            }

        case .callEnded(let p):
            activeCalls.removeValue(forKey: p.meetingId)
            if currentMeetingId == p.meetingId {
                peerManager?.cleanup()
                peerManager = nil
                currentMeetingId = nil
                callStartTime = nil
                cameraEnabled = false
                micEnabled = true
            }

        case .callParticipantJoined(let p):
            if var call = activeCalls[p.meetingId] {
                if !call.participants.contains(p.username) {
                    call.participants.append(p.username)
                    activeCalls[p.meetingId] = call
                }
            }
            // When someone joins our call, create peer with deterministic role
            if p.meetingId == currentMeetingId, p.username != AuthService.shared.username {
                let weInitiate = AuthService.shared.username > p.username
                peerManager?.createPeer(for: p.username, initiator: weInitiate)
            }

        case .callParticipantLeft(let p):
            if var call = activeCalls[p.meetingId] {
                call.participants.removeAll { $0 == p.username }
                activeCalls[p.meetingId] = call
            }
            if p.meetingId == currentMeetingId {
                peerManager?.removePeer(p.username)
            }

        default:
            break
        }
    }
}
