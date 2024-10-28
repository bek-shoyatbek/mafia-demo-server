import Room from "../models/Room.js";

export const generateRoomCode = async () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  let exists = true;

  while (exists) {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    exists = await Room.exists({ code });
  }

  return code;
};

export const assignRoles = (playerCount, roleSettings) => {
  const roles = [
    ...Array(roleSettings.MAFIA).fill("MAFIA"),
    ...Array(roleSettings.DETECTIVE).fill("DETECTIVE"),
    ...Array(roleSettings.DOCTOR).fill("DOCTOR"),
    ...Array(roleSettings.VILLAGER).fill("VILLAGER"),
  ];

  // Shuffle roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  return roles;
};

export const checkWinCondition = (game) => {
  const alivePlayers = game.players.filter((p) => p.isAlive);
  const aliveMafia = alivePlayers.filter((p) => p.role === "MAFIA").length;
  const aliveVillagers = alivePlayers.length - aliveMafia;

  if (aliveMafia === 0) return "VILLAGE";
  if (aliveMafia >= aliveVillagers) return "MAFIA";
  return null;
};
