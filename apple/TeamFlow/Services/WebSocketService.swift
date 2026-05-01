import Foundation
import Combine

final class WebSocketService: ObservableObject {
    static let shared = WebSocketService()

    let messageReceived = PassthroughSubject<ServerMessage, Never>()
    @Published var isConnected = false

    private var task: URLSessionWebSocketTask?
    private var pingTimer: Timer?
    private var reconnectTimer: Timer?
    private var token: String?

    var baseURL = "wss://teamflow.statlingo.ai"

    func connect(token: String) {
        self.token = token
        disconnect()

        guard let url = URL(string: "\(baseURL)/ws?token=\(token)") else { return }

        let session = URLSession(configuration: .default)
        task = session.webSocketTask(with: url)
        task?.resume()
        isConnected = true

        startPing()
        receiveMessage()
    }

    func disconnect() {
        pingTimer?.invalidate()
        pingTimer = nil
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        isConnected = false
    }

    func send(_ msg: ClientMessage) {
        guard let data = msg.jsonData, let str = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(str)) { error in
            if let error {
                print("WS send error: \(error)")
            }
        }
    }

    private func startPing() {
        pingTimer = Timer.scheduledTimer(withTimeInterval: 12, repeats: true) { [weak self] _ in
            self?.send(.ping)
        }
    }

    private func receiveMessage() {
        task?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    if let data = text.data(using: .utf8) {
                        let msg = ServerMessage.decode(from: data)
                        DispatchQueue.main.async {
                            self?.messageReceived.send(msg)
                        }
                    }
                case .data(let data):
                    let msg = ServerMessage.decode(from: data)
                    DispatchQueue.main.async {
                        self?.messageReceived.send(msg)
                    }
                @unknown default:
                    break
                }
                // Continue receiving
                self?.receiveMessage()

            case .failure(let error):
                print("WS receive error: \(error)")
                DispatchQueue.main.async {
                    self?.isConnected = false
                    self?.scheduleReconnect()
                }
            }
        }
    }

    private func scheduleReconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: false) { [weak self] _ in
            guard let self, let token = self.token else { return }
            print("WS reconnecting...")
            self.connect(token: token)
        }
    }
}
