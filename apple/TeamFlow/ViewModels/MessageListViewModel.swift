import Foundation
import Combine

@MainActor
final class MessageListViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var channelId: String?

    private var cancellables = Set<AnyCancellable>()

    init() {
        WebSocketService.shared.messageReceived
            .sink { [weak self] msg in self?.handleWS(msg) }
            .store(in: &cancellables)
    }

    func loadHistory(channelId: String) async {
        self.channelId = channelId
        do {
            messages = try await APIClient.shared.channelHistory(channelId)
        } catch {
            print("Load history failed: \(error)")
        }
    }

    func sendMessage(_ content: String) {
        guard let channelId, !content.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        WebSocketService.shared.send(.message(channelId: channelId, content: content))
    }

    private func handleWS(_ msg: ServerMessage) {
        switch msg {
        case .message(let p):
            if p.channelId == channelId {
                let message = Message(
                    id: p.id, channelId: p.channelId, userId: p.userId,
                    username: p.username, content: p.content, timestamp: p.timestamp
                )
                messages.append(message)
            }
        default:
            break
        }
    }
}

// Convenience init for Message from payload
extension Message {
    init(id: String, channelId: String, userId: String, username: String, content: String, timestamp: String) {
        self.id = id
        self.channelId = channelId
        self.userId = userId
        self.username = username
        self.content = content
        self.timestamp = timestamp
    }
}
