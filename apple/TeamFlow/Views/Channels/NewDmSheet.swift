import SwiftUI

struct NewDmSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var users: [User] = []
    @State private var isLoading = true
    var currentUserId: String
    var onCreated: (Channel) -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("New Direct Message")
                .font(.headline)

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 100)
            } else {
                ScrollView {
                    LazyVStack(spacing: 4) {
                        ForEach(users.filter { $0.id != currentUserId }) { user in
                            Button {
                                Task { await openDm(user) }
                            } label: {
                                HStack(spacing: 12) {
                                    Circle()
                                        .fill(avatarColor(for: user.username))
                                        .frame(width: 32, height: 32)
                                        .overlay(
                                            Text(String(user.username.prefix(1)).uppercased())
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(.white)
                                        )
                                    Text(user.username)
                                        .foregroundColor(.white)
                                    Spacer()
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.white.opacity(0.04))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxHeight: 300)
            }

            Button("Cancel") { dismiss() }
                .buttonStyle(.plain)
                .foregroundColor(.white.opacity(0.6))
        }
        .padding(24)
        .frame(width: 340)
        .background(Color(red: 0.08, green: 0.05, blue: 0.15))
        .task { await loadUsers() }
    }

    private func loadUsers() async {
        do {
            users = try await APIClient.shared.listUsers()
            isLoading = false
        } catch {
            isLoading = false
        }
    }

    private func openDm(_ user: User) async {
        do {
            let channel = try await APIClient.shared.getOrCreateDm(userId: user.id)
            onCreated(channel)
            dismiss()
        } catch {
            print("Failed to create DM: \(error)")
        }
    }

    private func avatarColor(for name: String) -> Color {
        let colors: [Color] = [.purple, .pink, .orange, .green, .cyan, .blue, .indigo]
        let hash = name.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return colors[abs(hash) % colors.count]
    }
}
