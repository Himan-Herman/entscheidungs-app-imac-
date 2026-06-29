import { prisma } from "./lib/prisma.js";

const main = async () => {
  const users = await prisma.user.findMany({ take: 1 });
  console.log(users);
};

main().finally(() => prisma.$disconnect());
