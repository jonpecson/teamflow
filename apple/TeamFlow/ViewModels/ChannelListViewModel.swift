import Foundation
import Combine

@MainActor
final class ChannelListViewModel: ObservableObject {
    @Published var channels: [Channel] = []
    @Published var dmChannels: [Channel] = []
    @Published var myChannelIds: Set<String> = []
    @Published var selectedChannelId: String?
    @Published var unreadCounts: [String: Int] = [:]
    @Published var onlineUsers: [String: String] = [:] // userId -> username

    private var cancellables = Set<AnyCancellable>()

    init() {
        WebSocketService.shared.messageReceived
            .sink { [weak self] msg in self?.handleWS(msg) }
            .store(in: &cancellables)
    }

    func load() async {
        do {
            let all = try await APIClient.shared.listChannels()
            let mine = try await APIClient.shared.myChannels()
            let online = try await APIClient.shared.onlineUsers()

            channels = all.filter { !$0.isDm }
            dmChannels = mine.filter { $0.isDm }
            myChannelIds = Set(mine.map { $0.id })
            onlineUsers = Dictionary(uniqueKeysWithValues: online.map { ($0.userId, $0.username) })

            // Auto-select general
            if selectedChannelId == nil {
                selectedChannelId = channels.first(where: { $0.name == "general" })?.id ?? channels.first?.id
            }
        } catch {
            print("Load channels failed: \(error)")
        }
    }

    func selectChannel(_ id: String) {
        selectedChannelId = id
        unreadCounts[id] = 0
    }

    private func handleWS(_ msg: ServerMessage) {
        switch msg {
        case .presence(let p):
            if p.status == "online" {
                onlineUsers[p.userId] = p.username
            } else {
                onlineUsers.removeValue(forKey: p.userId)
            }
        case .channelJoined(let p):
            myChannelIds.insert(p.channelId)
        case .channelLeft(let p):
            myChannelIds.remove(p.channelId)
        case .invited(let p):
            let ch = Channel(id: p.channelId, name: p.channelName, createdBy: nil, isDm: false, createdAt: nil)
            if !channels.contains(where: { $0.id == ch.id }) {
                channels.append(ch)
            }
            myChannelIds.insert(p.channelId)
        case .message(let p):
            if p.channelId != selectedChannelId {
                unreadCounts[p.channelId, default: 0] += 1
            }
        default:
            break
        }
    }
}
