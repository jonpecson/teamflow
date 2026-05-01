import SwiftUI

struct MainView: View {
    @StateObject private var channelVM = ChannelListViewModel()
    @StateObject private var messageVM = MessageListViewModel()
    @StateObject private var callVM = CallViewModel()
    @EnvironmentObject var auth: AuthService

    var body: some View {
        NavigationSplitView {
            SidebarView(vm: channelVM)
        } detail: {
            if let channelId = channelVM.selectedChannelId {
                let isInCall = callVM.currentMeetingId != nil &&
                    callVM.currentCall?.channelId == channelId

                if isInCall {
                    CallView(callVM: callVM)
                } else {
                    ChatDetailView(
                        channelId: channelId,
                        channelVM: channelVM,
                        messageVM: messageVM,
                        callVM: callVM
                    )
                }
            } else {
                emptyState
            }
        }
        .navigationSplitViewColumnWidth(min: 220, ideal: 260, max: 320)
        .task { await setup() }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundColor(.white.opacity(0.2))
            Text("Select a channel")
                .foregroundColor(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.06, green: 0.04, blue: 0.12))
    }

    private func setup() async {
        if let token = auth.token {
            WebSocketService.shared.connect(token: token)
        }
        await channelVM.load()
        await callVM.loadActiveCalls()
    }
}

struct ChatDetailView: View {
    let channelId: String
    @ObservedObject var channelVM: ChannelListViewModel
    @ObservedObject var messageVM: MessageListViewModel
    @ObservedObject var callVM: CallViewModel
    @EnvironmentObject var auth: AuthService
    @State private var input = ""

    private var channel: Channel? {
        let all = channelVM.channels + channelVM.dmChannels
        return all.first(where: { $0.id == channelId })
    }

    private var channelName: String {
        channel?.name ?? "channel"
    }

    private var activeCall: ActiveCall? {
        callVM.callForChannel(channelId)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("#\(channelName)")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(.white)

                if activeCall != nil {
                    Circle().fill(.green).frame(width: 8, height: 8)
                }

                Spacer()

                if !(channel?.isDm ?? true) {
                    Button {
                        Task {
                            await callVM.startCall(
                                channelId: channelId,
                                channelName: channelName,
                                username: auth.username
                            )
                        }
                    } label: {
                        Image(systemName: "phone.fill")
                            .foregroundColor(.green)
                            .padding(8)
                            .background(Color.green.opacity(0.1))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .help("Start huddle")
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .background(Color.white.opacity(0.03))

            // Call banner
            if let call = activeCall, callVM.currentMeetingId != call.meetingId {
                HStack(spacing: 12) {
                    Circle().fill(.green).frame(width: 10, height: 10)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(call.startedBy) started a call")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                        Text("\(call.participants.count) participant\(call.participants.count != 1 ? "s" : "")")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }

                    Spacer()

                    Button {
                        Task { await callVM.joinCall(meetingId: call.meetingId) }
                    } label: {
                        Text("Join")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 7)
                            .background(Color.green)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 10)
                .background(Color.green.opacity(0.06))
            }

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(messageVM.messages) { msg in
                            MessageRow(message: msg, isOwn: msg.userId == auth.userId)
                                .id(msg.id)
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)
                }
                .onChange(of: messageVM.messages.count) {
                    if let last = messageVM.messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            // Input
            if channelVM.myChannelIds.contains(channelId) {
                HStack(spacing: 12) {
                    TextField("Type a message...", text: $input)
                        .textFieldStyle(.plain)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.06))
                        .clipShape(Capsule())
                        .foregroundColor(.white)
                        .onSubmit { sendMessage() }

                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundStyle(.purple)
                    }
                    .buttonStyle(.plain)
                    .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
            }
        }
        .background(Color(red: 0.06, green: 0.04, blue: 0.12))
        .task(id: channelId) {
            channelVM.selectChannel(channelId)
            await messageVM.loadHistory(channelId: channelId)
        }
    }

    private func sendMessage() {
        let text = input.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        messageVM.sendMessage(text)
        input = ""
    }
}
