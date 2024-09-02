export type Camp = "RED" | "BLUE";

export interface CreateUserObj {
  id: string;
  room: string;
}

export class User {
  id: string;
  room: string;
  
  x!: number;
  y!: number;
  z!: number;

  camp!: Camp;

  health: number = 100;

  constructor(obj: CreateUserObj) {
    this.id = obj.id;
    this.room = obj.room;
  }

  updatePosition(x : number, y : number, z : number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  updateHealth(health : number) {
    this.health = health;
  }
}
