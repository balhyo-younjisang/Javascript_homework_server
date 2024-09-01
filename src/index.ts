import express, { Request, Response } from "express";
import http from "http";
import { createClient } from "redis";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { generateRoomName } from "./utils/random";
import { CreateUserObj, User } from "./types/User";
import { Room } from "./types/Room";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const pubClient = createClient({ url: "redis://redis:6379" });
const subClient = pubClient.duplicate();

const rooms: Room[] = [];

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
  })
  .catch((err) => {
    console.error(`Redis connection error : ${err}`);
  });

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const enterUser = (id: string, roomName: string) => {
  const obj: CreateUserObj = {
    id: id,
    room: roomName,
  };
  const user = new User(obj);
  const room = rooms.find((room) => room.roomName === roomName);
  room?.users.push(user);
};

const removeUser = (userId: string) => {
  const room = rooms.find((room) => room.users.find((user) => user.id === userId));

  if(!room || !room.users) return;
  room.users = room.users.filter((user) => user.id !== userId);

  rooms[rooms.indexOf(room!)] = room!;
  return room;
};

const initGame = () => {
  let flag = true;
  rooms.forEach((room) => {
    room.users.forEach((user) => {
      user.x = 0;
      user.y = 0;
      user.z = 0;
      user.camp = flag ? "RED" : "BLUE";
      flag = !flag;
    });
  });
};

io.on("connection", (socket: Socket) => {
  console.log("A user connected:", socket.id);

  // Room 생성
  socket.on("createRoom", () => {
    const roomName = generateRoomName();
    const room = new Room(roomName);
    rooms.push(room);
    socket.join(roomName);
    console.log(`User ${socket.id} created and joined room ${roomName}`);
    enterUser(socket.id, roomName);
    console.log(room.users.length);
    socket.emit("roomCreated", {
      roomId: roomName,
      players: room.users.length,
    });
  });

  // Room 참가
  socket.on("joinRoom", (roomName: string) => {
    if (roomName) {
      const roomIdx = rooms.findIndex((room) => room.roomName === roomName);

      if (roomIdx < 0) {
        socket.emit("error", "Room not found");
        return;
      }

      socket.join(roomName);
      console.log(`User ${socket.id} joined room ${roomName}`);
      enterUser(socket.id, roomName);
      const room = rooms.find((room) => room.roomName === roomName);
      io.to(roomName).emit("playerJoined", {
        id: socket.id,
        players: room?.users.length,
      });
      socket.emit("joinedRoom", { id: roomName, players: room?.users.length });
    } else {
      socket.emit("error", "Room name is required.");
    }
  });

  // 게임 시작 및 초기화
  socket.on("gameStart", async (roomName : string) => {
    const room = rooms.find((room) => room.roomName === roomName);

    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    if (room.users.length < 2) {
      socket.emit("error", "Not enough players");
      return;
    }

    initGame();
    io.to(room?.roomName!).emit("startedGame", {
      id: socket.id,
      message: "The game starts soon",
    });
  });

  socket.on('gameInit', (roomId : string) => {
    const room = rooms.find(room => room.roomName === roomId)
    socket.emit("initPlayer", {id: socket.id, players: room?.users});
  })

  // 플레이어 이동
  socket.on('move', (data) => {
    const players = rooms.find(room => room.roomName === data.roomId)?.users;
    const player = players?.find((user) => user.id === socket.id);

    if (player) {
        player.updatePosition(data.x, data.y, data.z);
        socket.broadcast.emit('update', { id: socket.id, x : player.x, y : player.y, z : player.z });
    }
});

  // 연결 해제
  socket.on("disconnect", async () => {
    await pubClient.hDel("players", socket.id);
    console.log(`User ${socket.id} disconnected`);
    const room = removeUser(socket.id);

    io.to(room?.roomName!).emit("playerDisconnected", {
      id: socket.id,
      players: room?.users.length,
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
