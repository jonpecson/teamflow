import SwiftUI
import LiveKitWebRTC

#if os(macOS)
struct VideoRendererView: NSViewRepresentable {
    let track: RTCVideoTrack
    var mirror: Bool = false

    func makeNSView(context: Context) -> RTCMTLNSVideoView {
        let view = RTCMTLNSVideoView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.clear.cgColor
        if mirror {
            view.layer?.transform = CATransform3DMakeScale(-1, 1, 1)
        }
        track.add(view)
        context.coordinator.view = view
        context.coordinator.track = track
        return view
    }

    func updateNSView(_ nsView: RTCMTLNSVideoView, context: Context) {
        if context.coordinator.track !== track {
            context.coordinator.track?.remove(nsView)
            track.add(nsView)
            context.coordinator.track = track
        }
    }

    static func dismantleNSView(_ nsView: RTCMTLNSVideoView, coordinator: Coordinator) {
        coordinator.track?.remove(nsView)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator {
        var view: RTCMTLNSVideoView?
        var track: RTCVideoTrack?
    }
}
#endif
