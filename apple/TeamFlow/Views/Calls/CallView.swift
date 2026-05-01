import SwiftUI
import LiveKitWebRTC

struct CallView: View {
    @ObservedObject var callVM: CallViewModel
    @State private var timer = "00:00"
    @State private var timerTask: Timer?

    var body: some View {
        if let call = callVM.currentCall {
            VStack(spacing: 0) {
                // Header
                HStack {
                    Circle().fill(.green).frame(width: 10, height: 10)
                    Text("#\(call.channelName)")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                    Text(timer)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundColor(.green)
                    Text("\(call.participants.count) participants")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.4))
                    Spacer()
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
                .background(Color.white.opacity(0.03))

                // Participant grid
                ScrollView {
                    let columns = gridColumns(for: call.participants.count)
                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(call.participants, id: \.self) { username in
                            let isLocal = username == AuthService.shared.username
                            let localTrack = isLocal ? callVM.peerManager?.localVideoTrack : nil
                            let remoteTrack = !isLocal ? callVM.peerManager?.remoteVideoTracks[username] : nil
                            let videoTrack = localTrack ?? remoteTrack

                            ParticipantTileView(
                                username: username,
                                isLocal: isLocal,
                                videoTrack: videoTrack
                            )
                        }
                    }
                    .padding(14)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                // Controls
                HStack(spacing: 16) {
                    controlButton(
                        icon: callVM.micEnabled ? "mic.fill" : "mic.slash.fill",
                        active: callVM.micEnabled,
                        danger: !callVM.micEnabled
                    ) {
                        callVM.toggleMic()
                    }

                    controlButton(
                        icon: callVM.cameraEnabled ? "video.fill" : "video.slash.fill",
                        active: callVM.cameraEnabled,
                        danger: false
                    ) {
                        callVM.toggleCamera()
                    }

                    controlButton(icon: "rectangle.inset.filled.and.person.filled", active: false, danger: false) {
                        // Screen share placeholder
                    }

                    Spacer()

                    Button {
                        callVM.leaveCall()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "phone.down.fill")
                            Text("Leave")
                        }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.red)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)

                    if call.startedBy == AuthService.shared.username {
                        Button {
                            callVM.endCall()
                        } label: {
                            Text("End")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.red)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(Color.red.opacity(0.15))
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
                .background(Color.white.opacity(0.03))
            }
            .background(Color(red: 0.05, green: 0.03, blue: 0.1))
            .onAppear { startTimer() }
            .onDisappear { timerTask?.invalidate() }
        }
    }

    private func controlButton(icon: String, active: Bool, danger: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundColor(danger ? .red : active ? .purple : .white.opacity(0.6))
                .frame(width: 44, height: 44)
                .background(
                    danger ? Color.red.opacity(0.15) :
                    active ? Color.purple.opacity(0.15) :
                    Color.white.opacity(0.06)
                )
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }

    private func gridColumns(for count: Int) -> [GridItem] {
        switch count {
        case 1: return [GridItem(.flexible())]
        case 2: return [GridItem(.flexible()), GridItem(.flexible())]
        default: return [GridItem(.flexible()), GridItem(.flexible())]
        }
    }

    private func startTimer() {
        timerTask = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            guard let start = callVM.callStartTime else { return }
            let elapsed = Int(Date().timeIntervalSince(start))
            let mins = elapsed / 60
            let secs = elapsed % 60
            DispatchQueue.main.async {
                timer = String(format: "%02d:%02d", mins, secs)
            }
        }
    }
}

struct ParticipantTileView: View {
    let username: String
    let isLocal: Bool
    var videoTrack: RTCVideoTrack?

    private var color: Color {
        let colors: [Color] = [.purple, .pink, .orange, .green, .cyan, .blue, .indigo]
        let hash = username.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return colors[abs(hash) % colors.count]
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.03))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.06))
                )
                .aspectRatio(16/9, contentMode: .fit)

            if let track = videoTrack {
                #if os(macOS)
                VideoRendererView(track: track, mirror: isLocal)
                    .aspectRatio(16/9, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                #endif
            } else {
                RoundedRectangle(cornerRadius: 14)
                    .fill(color)
                    .frame(width: 56, height: 56)
                    .overlay(
                        Text(String(username.prefix(1)).uppercased())
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.white)
                    )
            }

            VStack {
                Spacer()
                HStack {
                    Text(isLocal ? "\(username) (You)" : username)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.black.opacity(0.5))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    Spacer()
                }
                .padding(8)
            }
        }
    }
}
