import { User } from "./User";

export class Room {
    users :  User[]  = [];
    roomName: string;

    constructor(roomName : string) {
        this.roomName = roomName;
    }
}