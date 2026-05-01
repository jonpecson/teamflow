import Foundation
import LiveKitWebRTC

final class WebRTCClient: NSObject {
    private static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        return RTCPeerConnectionFactory()
    }()

    private let peerConnection: RTCPeerConnection
    private var localAudioTrack: RTCAudioTrack?
    private var localVideoTrack: RTCVideoTrack?
    private var videoCapturer: RTCCameraVideoCapturer?
    private var videoSource: RTCVideoSource?
    var onIceCandidate: ((RTCIceCandidate) -> Void)?
    var onRemoteTrack: ((RTCMediaStreamTrack) -> Void)?
    var onConnectionStateChange: ((RTCIceConnectionState) -> Void)?

    override init() {
        let config = RTCConfiguration()
        config.iceServers = [
            RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]),
            RTCIceServer(urlStrings: ["stun:stun1.l.google.com:19302"]),
            // TURN server for NAT traversal
            RTCIceServer(
                urlStrings: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443"],
                username: "openrelayproject",
                credential: "openrelayproject"
            ),
        ]
        config.sdpSemantics = .unifiedPlan

        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: ["DtlsSrtpKeyAgreement": "true"]
        )

        peerConnection = Self.factory.peerConnection(with: config, constraints: constraints, delegate: nil)!
        super.init()
        peerConnection.delegate = self
    }

    // MARK: - Local Media

    func startAudio() {
        let audioConstraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        let audioSource = Self.factory.audioSource(with: audioConstraints)
        let audioTrack = Self.factory.audioTrack(with: audioSource, trackId: "audio0")
        audioTrack.isEnabled = true
        peerConnection.add(audioTrack, streamIds: ["stream0"])
        localAudioTrack = audioTrack
    }

    func startVideo() -> RTCVideoTrack? {
        // Don't start twice
        if localVideoTrack != nil { return localVideoTrack }

        #if os(macOS)
        let devices = RTCCameraVideoCapturer.captureDevices()
        guard let device = devices.first else {
            print("[WebRTC] No camera devices found")
            return nil
        }

        let formats = RTCCameraVideoCapturer.supportedFormats(for: device)
        guard !formats.isEmpty else {
            print("[WebRTC] No supported formats for camera")
            return nil
        }

        let source = Self.factory.videoSource()
        self.videoSource = source

        // Constrain video to avoid encoder crash on macOS with WebRTC M96
        source.adaptOutputFormat(toWidth: 480, height: 360, fps: 15)

        let videoTrack = Self.factory.videoTrack(with: source, trackId: "video0")
        videoTrack.isEnabled = true
        peerConnection.add(videoTrack, streamIds: ["stream0"])
        localVideoTrack = videoTrack

        let capturer = RTCCameraVideoCapturer(delegate: source)
        self.videoCapturer = capturer

        // Use the smallest available format to minimize encoder load
        guard let format = formats
            .sorted(by: { CMVideoFormatDescriptionGetDimensions($0.formatDescription).width < CMVideoFormatDescriptionGetDimensions($1.formatDescription).width })
            .first else { return nil }

        let dims = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
        print("[WebRTC] Starting camera: \(dims.width)x\(dims.height) (adapted to 480x360@15fps)")

        capturer.startCapture(with: device, format: format, fps: 15)
        return videoTrack
        #else
        return nil
        #endif
    }

    func stopVideo() {
        videoCapturer?.stopCapture()
        videoCapturer = nil
        localVideoTrack?.isEnabled = false
        localVideoTrack = nil
        videoSource = nil
    }

    func setAudioEnabled(_ enabled: Bool) {
        localAudioTrack?.isEnabled = enabled
    }

    func setVideoEnabled(_ enabled: Bool) {
        localVideoTrack?.isEnabled = enabled
    }

    // MARK: - Signaling

    func createOffer() async throws -> RTCSessionDescription {
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: [
                "OfferToReceiveAudio": "true",
                "OfferToReceiveVideo": "true",
            ],
            optionalConstraints: nil
        )
        return try await withCheckedThrowingContinuation { continuation in
            peerConnection.offer(for: constraints) { sdp, error in
                if let error { continuation.resume(throwing: error); return }
                guard let sdp else { continuation.resume(throwing: WebRTCError.noSDP); return }
                self.peerConnection.setLocalDescription(sdp) { error in
                    if let error { continuation.resume(throwing: error); return }
                    continuation.resume(returning: sdp)
                }
            }
        }
    }

    func createAnswer() async throws -> RTCSessionDescription {
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: [
                "OfferToReceiveAudio": "true",
                "OfferToReceiveVideo": "true",
            ],
            optionalConstraints: nil
        )
        return try await withCheckedThrowingContinuation { continuation in
            peerConnection.answer(for: constraints) { sdp, error in
                if let error { continuation.resume(throwing: error); return }
                guard let sdp else { continuation.resume(throwing: WebRTCError.noSDP); return }
                self.peerConnection.setLocalDescription(sdp) { error in
                    if let error { continuation.resume(throwing: error); return }
                    continuation.resume(returning: sdp)
                }
            }
        }
    }

    func setRemoteDescription(_ sdp: RTCSessionDescription) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            peerConnection.setRemoteDescription(sdp) { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }

    func addIceCandidate(_ candidate: RTCIceCandidate) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            peerConnection.add(candidate) { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }

    func close() {
        videoCapturer?.stopCapture()
        videoCapturer = nil
        videoSource = nil
        localAudioTrack = nil
        localVideoTrack = nil
        peerConnection.close()
    }

    enum WebRTCError: Error {
        case noSDP
    }
}

// MARK: - RTCPeerConnectionDelegate

extension WebRTCClient: RTCPeerConnectionDelegate {
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
        stream.audioTracks.forEach { onRemoteTrack?($0) }
        stream.videoTracks.forEach { onRemoteTrack?($0) }
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}

    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        onConnectionStateChange?(newState)
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        onIceCandidate?(candidate)
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}
