import SwiftUI

struct SidebarView: View {
    @ObservedObject var vm: ChannelListViewModel
    @EnvironmentObject var auth: AuthService
    @State private var showCreateChannel = false
    @State private var showNewDm = false

    var body: some View {
        List(selection: $vm.selectedChannelId) {
            Section {
                ForEach(vm.channels) { channel in
                    HStack {
                        Text("#")
                            .foregroundColor(.white.opacity(0.3))
                            .font(.system(size: 14, weight: .medium))
                        Text(channel.name)
                            .font(.system(size: 14))
                        Spacer()
                        if let count = vm.unreadCounts[channel.id], count > 0 {
                            Text("\(count)")
                                .font(.caption2.bold())
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.purple)
                                .clipShape(Capsule())
                        }
                    }
                    .tag(channel.id)
                }
            } header: {
                HStack {
                    Text("Channels")
                    Spacer()
                    Button { showCreateChannel = true } label: {
                        Image(systemName: "plus")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.4))
                    }
                    .buttonStyle(.plain)
                }
            }

            if !vm.dmChannels.isEmpty {
                Section("Direct Messages") {
                    ForEach(vm.dmChannels) { channel in
                        let displayName = channel.name
                            .replacingOccurrences(of: "dm-", with: "")
                            .replacingOccurrences(of: auth.username, with: "")
                            .replacingOccurrences(of: "-", with: "")
                            .trimmingCharacters(in: .whitespaces)

                        HStack {
                            Circle()
                                .fill(vm.onlineUsers.values.contains(displayName) ? Color.green : Color.gray.opacity(0.3))
                                .frame(width: 8, height: 8)
                            Text(displayName)
                                .font(.system(size: 14))
                            Spacer()
                            if let count = vm.unreadCounts[channel.id], count > 0 {
                                Text("\(count)")
                                    .font(.caption2.bold())
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.purple)
                                    .clipShape(Capsule())
                            }
                        }
                        .tag(channel.id)
                    }
                }
            }

            Section("Team (\(vm.onlineUsers.count))") {
                ForEach(Array(vm.onlineUsers.values.sorted()), id: \.self) { username in
                    HStack(spacing: 8) {
                        Circle().fill(.green).frame(width: 8, height: 8)
                        Text(username)
                            .font(.system(size: 13))
                        if username == auth.username {
                            Text("(you)")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.3))
                        }
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("TeamFlow")
        #if os(macOS)
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button { showNewDm = true } label: {
                    Image(systemName: "square.and.pencil")
                }
                .help("New direct message")
            }
            ToolbarItem(placement: .automatic) {
                Button { auth.logout() } label: {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                }
                .help("Sign out")
            }
        }
        #endif
        .sheet(isPresented: $showCreateChannel) {
            CreateChannelSheet { channel in
                vm.channels.append(channel)
                vm.myChannelIds.insert(channel.id)
                vm.selectedChannelId = channel.id
            }
        }
        .sheet(isPresented: $showNewDm) {
            NewDmSheet(currentUserId: auth.userId) { channel in
                if !vm.dmChannels.contains(where: { $0.id == channel.id }) {
                    vm.dmChannels.append(channel)
                }
                vm.myChannelIds.insert(channel.id)
                vm.selectedChannelId = channel.id
            }
        }
    }
}
