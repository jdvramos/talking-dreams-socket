const io = require("socket.io")(8001, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

let onlineUsers = [];

const addUser = (userId, socketId, userInfo) => {
    // Checks if the user that is connected, already exist in the onlineUsers array
    const alreadyExist = onlineUsers.some((u) => u.userId === userId);

    if (!alreadyExist) {
        onlineUsers.push({ userId, socketId, userInfo });
    }
};

const userRemove = (socketId) => {
    onlineUsers = onlineUsers.filter((u) => u.socketId !== socketId);
};

// This functions returns a user information if the id that is passed in is in the 'onlineUsers' array which corresponds to users that are currently online
const findFriend = (id) => {
    return onlineUsers.find((u) => u.userId === id);
};

const userLogout = (userId) => {
    onlineUsers = onlineUsers.filter((u) => u.userId !== userId);
};

const updateAnOnlineUser = (userId, newFriendsList) => {
    // Find the index of the user object that needs to be updated
    const userIndex = onlineUsers.findIndex((user) => user.userId === userId);

    if (userIndex !== -1) {
        // Get the user object to be modified
        const userToBeModified = onlineUsers[userIndex];

        // Perform the necessary modifications on the user object
        userToBeModified.userInfo.friends = newFriendsList;

        // Update the user object in the onlineUsers array
        onlineUsers[userIndex] = userToBeModified;
    }
};

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("addUser", (userId, userInfo) => {
        addUser(userId, socket.id, userInfo);

        const idsOfFriendsOfUser = userInfo.friends.map(
            (friend) => friend.friendId
        );

        const socketIds = onlineUsers
            .filter((user) => idsOfFriendsOfUser.includes(user.userId))
            .map((user) => user.socketId);

        socket.emit("getAllOnlineUsers", onlineUsers);

        socketIds.forEach((socketId) =>
            socket.to(socketId).emit("getAllOnlineUsers", onlineUsers)
        );
    });

    socket.on("sendMessage", (message) => {
        const friendData = findFriend(message.receiverId);

        // Basically, we want our real-time communication to work only if the receiver of the message is online, if not we will simply append the new message to our database. If user is undefined it means that the receiver is not in the 'users' array which means that the receiver is currently offline.
        // NOTE: We used socket.to(user.socketId).emit(), this was discussed in the fundamentals section but in that lesson we setup rooms. However, in Socket.io you can also pass in socket.id as argument to the socket.to(), here we pass in the socketId of the receiver, this means that our getMessage action will only be emitted to that user and not anyone else.
        if (friendData !== undefined) {
            socket.to(friendData.socketId).emit("receiveMessage", message);
        }
    });

    socket.on("messageSeenByFriend", (seenSocketMessage) => {
        const user = findFriend(seenSocketMessage.senderId);

        if (user !== undefined) {
            socket
                .to(user.socketId)
                .emit("messageSeenByFriendResponse", seenSocketMessage);
        }
    });

    socket.on("friendIsTyping", (typingInfo) => {
        const user = findFriend(typingInfo.receiverId);

        if (user !== undefined) {
            socket.to(user.socketId).emit("friendIsTypingResponse", typingInfo);
        }
    });

    socket.on("sendFriendRequest", (senderData, receiverId, senderFullName) => {
        const user = findFriend(receiverId);

        if (user !== undefined) {
            socket
                .to(user.socketId)
                .emit("friendRequestReceived", senderData, senderFullName);
        }
    });

    socket.on("cancelFriendRequest", (senderId, receiverOfRequestId) => {
        const user = findFriend(receiverOfRequestId);

        if (user !== undefined) {
            socket
                .to(user.socketId)
                .emit("cancelFriendRequestResponse", senderId);
        }
    });

    socket.on("declineFriendRequest", (receiverId, senderOfRequestId) => {
        const user = findFriend(senderOfRequestId);

        if (user !== undefined) {
            socket
                .to(user.socketId)
                .emit("declineFriendRequestResponse", receiverId);
        }
    });

    socket.on(
        "acceptFriendRequest",
        (receiverId, receiverFullName, senderOfRequestId) => {
            const user = findFriend(senderOfRequestId);

            if (user !== undefined) {
                socket
                    .to(user.socketId)
                    .emit(
                        "acceptFriendRequestResponse",
                        receiverId,
                        receiverFullName
                    );
            }
        }
    );

    socket.on("getOnlineUsersAgain", (userId, userFriends) => {
        updateAnOnlineUser(userId, userFriends);

        const userData = findFriend(userId);

        const idsOfFriendsOfUser = userData.userInfo.friends.map(
            (friend) => friend.friendId
        );

        const socketIds = onlineUsers
            .filter((user) => idsOfFriendsOfUser.includes(user.userId))
            .map((user) => user.socketId);

        socketIds.forEach((socketId) =>
            socket.to(socketId).emit("getAllOnlineUsers", onlineUsers)
        );
    });

    socket.on("newUserRegistered", (userInfo) => {
        io.emit("newUserRegisteredResponse", userInfo);
    });

    socket.on("logout", (userId) => {
        const dataOfUserLoggingOut = onlineUsers.find(
            (user) => user.userId === userId
        );

        if (dataOfUserLoggingOut) {
            const idsOfFriendsOfUserLoggingOut =
                dataOfUserLoggingOut.userInfo.friends.map(
                    (friend) => friend.friendId
                );

            const socketIds = onlineUsers
                .filter((user) =>
                    idsOfFriendsOfUserLoggingOut.includes(user.userId)
                )
                .map((user) => user.socketId);

            userLogout(userId); // removes user from the onlineUsers

            socketIds.forEach((socketId) =>
                socket.to(socketId).emit("getAllOnlineUsers", onlineUsers)
            );
        }
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected...");

        const dataOfUserLoggingOut = onlineUsers.find(
            (user) => user.socketId === socket.id
        );

        if (dataOfUserLoggingOut) {
            const idsOfFriendsOfUserLoggingOut =
                dataOfUserLoggingOut.userInfo.friends.map(
                    (friend) => friend.friendId
                );

            const socketIds = onlineUsers
                .filter((user) =>
                    idsOfFriendsOfUserLoggingOut.includes(user.userId)
                )
                .map((user) => user.socketId);

            userRemove(socket.id);

            socketIds.forEach((socketId) =>
                socket.to(socketId).emit("getAllOnlineUsers", onlineUsers)
            );
        }
    });
});
