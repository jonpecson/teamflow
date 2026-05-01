import SwiftUI

struct MessageRow: View {
    let message: Message
    let isOwn: Bool

    private var avatarColor: Color {
        let colors: [Color] = [.purple, .pink, .orange, .green, .cyan, .blue, .indigo]
        let hash = message.username.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return colors[abs(hash) % colors.count]
    }

    private var timeString: String {
        // Parse ISO8601 and format to HH:mm
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: message.timestamp) {
            let tf = DateFormatter()
            tf.dateFormat = "HH:mm"
            return tf.string(from: date)
        }
        return ""
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if isOwn { Spacer(minLength: 60) }

            if !isOwn {
                Circle()
                    .fill(avatarColor)
                    .frame(width: 32, height: 32)
                    .overlay(Text(String(message.username.prefix(1)).uppercased())
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white))
            }

            VStack(alignment: isOwn ? .trailing : .leading, spacing: 4) {
                if !isOwn {
                    HStack(spacing: 6) {
                        Text(message.username)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                        Text(timeString)
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.3))
                    }
                }

                Text(message.content)
                    .font(.system(size: 14))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .foregroundColor(.white)
                    .background(
                        isOwn
                            ? AnyShapeStyle(LinearGradient(colors: [.purple, Color(red: 0.42, green: 0.36, blue: 0.9)], startPoint: .leading, endPoint: .trailing))
                            : AnyShapeStyle(Color.white.opacity(0.06))
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }

            if !isOwn { Spacer(minLength: 60) }
        }
        .padding(.vertical, 2)
    }
}
