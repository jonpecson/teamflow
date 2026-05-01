import SwiftUI

struct CreateChannelSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var error: String?
    @State private var isLoading = false
    var onCreated: (Channel) -> Void

    var body: some View {
        VStack(spacing: 20) {
            Text("Create Channel")
                .font(.headline)

            TextField("channel-name", text: $name)
                #if os(macOS)
                .textFieldStyle(.plain)
                #endif
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(Color(red: 0.1, green: 0.07, blue: 0.18))
                .overlay(RoundedRectangle(cornerRadius: 25).stroke(Color.white.opacity(0.1)))
                .clipShape(RoundedRectangle(cornerRadius: 25))
                .foregroundColor(.white)

            Text("Lowercase letters, numbers, hyphens, underscores")
                .font(.caption)
                .foregroundColor(.white.opacity(0.4))

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
            }

            HStack {
                Button("Cancel") { dismiss() }
                    .buttonStyle(.plain)
                    .foregroundColor(.white.opacity(0.6))

                Spacer()

                Button {
                    Task { await create() }
                } label: {
                    Text(isLoading ? "Creating..." : "Create")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                        .background(Color.purple)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(name.isEmpty || isLoading)
            }
        }
        .padding(24)
        .frame(width: 340)
        .background(Color(red: 0.08, green: 0.05, blue: 0.15))
    }

    private func create() async {
        isLoading = true
        error = nil
        do {
            let channel = try await APIClient.shared.createChannel(name: name.lowercased())
            onCreated(channel)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
