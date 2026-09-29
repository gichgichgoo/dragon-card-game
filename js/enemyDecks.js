import { cloneBuild } from "./deck.js";

export const CPU_DECKS = {
  easy: [
    {
      name: "小竜連打",
      build: {
        dragons: ["whelp", "life", "shell"],
        basic: {
          spark: 2,
          heal: 1,
          study: 1,
          ward: 1,
        },
        tactical: {
          recall: 1,
          echo: 1,
          banish: 1,
          surge: 1,
        },
        powerful: {
          inferno: 1,
          sacrifice: 1,
        },
      },
    },

    {
      name: "守りの学習",
      build: {
        dragons: ["whelp", "shell", "sage"],
        basic: {
          heal: 2,
          study: 1,
          cycle: 1,
          ward: 1,
        },
        tactical: {
          foresee: 1,
          recall: 1,
          banish: 1,
          fog: 1,
        },
        powerful: {
          inferno: 1,
          revive: 1,
        },
      },
    },

    {
      name: "古竜見習い",
      build: {
        dragons: ["whelp", "dragon", "life"],
        basic: {
          spark: 1,
          heal: 1,
          study: 1,
          cycle: 1,
          ward: 1,
        },
        tactical: {
          foresee: 1,
          banish: 1,
          echo: 1,
          surge: 1,
        },
        powerful: {
          inferno: 1,
          revive: 1,
        },
      },
    },
  ],

  normal: [
    {
      name: "雷鏡テンポ",
      build: {
        dragons: ["thunder", "mirror", "whelp"],
        basic: {
          spark: 2,
          study: 1,
          ward: 1,
          cycle: 1,
        },
        tactical: {
          foresee: 1,
          banish: 1,
          echo: 1,
          fog: 1,
        },
        powerful: {
          inferno: 1,
          sacrifice: 1,
        },
      },
    },

    {
      name: "封魔古竜",
      build: {
        dragons: ["dragon", "void", "shell"],
        basic: {
          spark: 1,
          heal: 1,
          study: 1,
          steal: 1,
          ward: 1,
        },
        tactical: {
          foresee: 1,
          banish: 2,
          fog: 1,
        },
        powerful: {
          inferno: 1,
          revive: 1,
        },
      },
    },

    {
      name: "残響再生",
      build: {
        dragons: ["whelp", "thunder", "phantom"],
        basic: {
          spark: 1,
          study: 1,
          steal: 1,
          ward: 1,
          cycle: 1,
        },
        tactical: {
          recall: 1,
          foresee: 1,
          banish: 1,
          surge: 1,
        },
        powerful: {
          revive: 1,
          sacrifice: 1,
        },
      },
    },
  ],

  hard: [
    {
      name: "古竜支配",
      build: {
        dragons: ["dragon", "phantom", "void"],
        basic: {
          study: 1,
          steal: 1,
          ward: 1,
          cycle: 2,
        },
        tactical: {
          foresee: 1,
          banish: 2,
          fog: 1,
        },
        powerful: {
          revive: 1,
          inferno: 1,
        },
      },
    },

    {
      name: "連鎖残響",
      build: {
        dragons: ["whelp", "thunder", "berserk"],
        basic: {
          spark: 2,
          study: 1,
          ward: 1,
          cycle: 1,
        },
        tactical: {
          echo: 1,
          foresee: 1,
          recall: 1,
          surge: 1,
        },
        powerful: {
          sacrifice: 2,
        },
      },
    },

    {
      name: "拘束鏡殻",
      build: {
        dragons: ["mirror", "shell", "void"],
        basic: {
          heal: 1,
          study: 1,
          steal: 1,
          ward: 1,
          cycle: 1,
        },
        tactical: {
          banish: 1,
          fog: 2,
          foresee: 1,
        },
        powerful: {
          inferno: 1,
          revive: 1,
        },
      },
    },
  ],
};

export function pickCpuDeck(
  difficulty = "normal",
  random = Math.random
) {
  const pool =
    CPU_DECKS[difficulty] ??
    CPU_DECKS.normal;

  const chosen =
    pool[
      Math.floor(
        random() * pool.length
      )
    ];

  return {
    difficulty,
    name: chosen.name,
    build: cloneBuild(
      chosen.build
    ),
  };
}
