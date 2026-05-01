import LiveKitWebRTC

// LiveKit's WebRTC build prefixes all types with "LK".
// These typealiases keep our code compatible with standard WebRTC naming.
typealias RTCPeerConnection = LKRTCPeerConnection
typealias RTCPeerConnectionDelegate = LKRTCPeerConnectionDelegate
typealias RTCPeerConnectionFactory = LKRTCPeerConnectionFactory
typealias RTCConfiguration = LKRTCConfiguration
typealias RTCIceServer = LKRTCIceServer
typealias RTCMediaConstraints = LKRTCMediaConstraints
typealias RTCSessionDescription = LKRTCSessionDescription
typealias RTCIceCandidate = LKRTCIceCandidate
typealias RTCAudioTrack = LKRTCAudioTrack
typealias RTCVideoTrack = LKRTCVideoTrack
typealias RTCMediaStreamTrack = LKRTCMediaStreamTrack
typealias RTCMediaStream = LKRTCMediaStream
typealias RTCDataChannel = LKRTCDataChannel
typealias RTCCameraVideoCapturer = LKRTCCameraVideoCapturer
typealias RTCVideoSource = LKRTCVideoSource
typealias RTCSignalingState = LKRTCSignalingState
typealias RTCIceConnectionState = LKRTCIceConnectionState
typealias RTCIceGatheringState = LKRTCIceGatheringState

#if os(macOS)
typealias RTCMTLNSVideoView = LKRTCMTLNSVideoView
#endif

func RTCInitializeSSL() {
    LKRTCInitializeSSL()
}
