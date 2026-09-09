# 🚀 Neon Vanguard

Arcade *space shooter* jogável no navegador, feito com **React + TypeScript + PixiJS**.
Sobreviva às ondas de inimigos, colete power-ups e suba no ranking.

**▶️ Jogar:** _(link do GitHub Pages entra aqui após o deploy)_

![stack](https://img.shields.io/badge/React-18-38bdf8) ![stack](https://img.shields.io/badge/TypeScript-5-3178c6) ![stack](https://img.shields.io/badge/PixiJS-8-ff3ea5)

## ✨ Destaques técnicos

- **Game loop** próprio sobre o `ticker` do PixiJS, com *delta time* clampado para física estável independente do FPS.
- **Renderização 2D** 100% via `PixiJS.Graphics` (sem assets externos) — nave, inimigos, tiros, partículas e estrelas.
- **Integração React + PixiJS**: React cuida das telas (título, HUD, game over) e se comunica com o motor por callbacks; o PixiJS roda o canvas.
- **Colisões** por distância ao quadrado (sem `sqrt` no hot path).
- **Sistema de partículas** aditivas (blend `add`) para explosões, com *cap* para proteger a performance.
- **Ondas progressivas**: quantidade, velocidade e tipos de inimigos escalam; inimigos "brute" perseguem e atiram.
- **Power-ups**: tiro rápido, tiro triplo e escudo temporário.
- **Input unificado**: mouse, teclado (WASD/setas) e **touch** (arrastar) — responsivo em desktop e celular.
- **Áudio** sintetizado em tempo real com a Web Audio API.
- **High score** persistido em `localStorage`.

## 🎮 Como jogar

- **Mover:** mouse, `WASD`/setas, ou arrastar no celular.
- **Atirar:** automático.
- Encoste nos power-ups para ativá-los. Evite inimigos e seus tiros.

## 🛠️ Rodando localmente

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

## 📦 Deploy (GitHub Pages)

O `vite.config.ts` usa `base: './'`, então o build funciona em qualquer subpasta do Pages.

```bash
npm run deploy
```

(usa o pacote `gh-pages` para publicar a pasta `dist` na branch `gh-pages`)

---

Feito por **Gustavo Mascarenhas Amorim** · [GitHub](https://github.com/GMA-Gustavo) · [LinkedIn](https://www.linkedin.com/in/gustavo-mascarenhas-83651a2a6)
