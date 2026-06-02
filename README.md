# JG.3DGame - Manual do Jogo

Jogo 3D em primeira pessoa com combate, missoes, cutscenes e habilidades magicas, feito com Babylon.js.

## Visao Geral

- Estilo: acao em primeira pessoa com progressao por missoes
- Mapa: floresta, acampamento, rio, castelo e inimigos especiais
- Inimigos: mortos-vivos, elfos sombrios, dragoes de fogo e dragoes de vento
- Progresso: desbloqueio de habilidades por dialogos e eventos da historia

## Requisitos

- Navegador moderno com suporte a WebGL
- VS Code (recomendado) ou qualquer servidor HTTP local
- Python instalado (opcional, para servidor local via terminal)

## Como Rodar

### Opcao 1: Task do VS Code

1. Abra a pasta do projeto no VS Code.
2. Rode a task "Launch Live Server".
3. Abra o endereco http://localhost:8000.

### Opcao 2: Servidor Python

1. No terminal, na raiz do projeto, execute:

```bash
python -m http.server 8000
```

2. Abra http://localhost:8000 no navegador.

## Estrutura do Projeto

```text
JG.3DGame/
|- index.html      # Estrutura da pagina e HUD
|- style.css       # Estilos da interface
|- game.js         # Logica principal do jogo
|- assets/         # Sprites e imagens
|- README.md       # Manual
```

## Controles

### Movimento e Camera

| Tecla | Acao |
|---|---|
| W / A / S / D | Mover personagem |
| Setas (Up/Down/Left/Right) | Girar camera |
| Space | Pular |

### Combate e Habilidades

| Tecla | Acao |
|---|---|
| F (toque rapido) | Ataque de espada |
| F (segurar) | Dark Energy (quando desbloqueado e sem cooldown) |
| Q | Water Slash (quando desbloqueado) |
| R | Wind Slash (quando desbloqueado) |
| E (toque rapido) | Interagir (entrar/sair da casa, falar com NPC, abrir/fechar missoes) |
| E (segurar) | Fire Slash (quando desbloqueado) |

### UI de Missoes

Quando a tela de missoes estiver aberta:

- Arrow Down / Arrow Up: rolar lista
- Page Down / Page Up: rolagem longa
- E: fechar tela de missoes

## Atalhos de Debug

### Spawn de Dragoes

- D + D + 1: spawn do dragao de fogo
- D + D + 2: spawn do segundo dragao (dragao de vento)

Observacao:

- O atalho funciona em sequencia rapida: pressione D duas vezes e, em seguida, 1 ou 2.

## Fluxo Basico de Jogo

1. Explore a area inicial.
2. Interaja com NPCs para abrir a tela de missoes.
3. Aceite uma missao disponivel.
4. Elimine os inimigos conforme o objetivo.
5. Conclua a missao para liberar as proximas etapas e habilidades.

## Dicas

- Use ataques rapidos de espada (F toque) para economizar cooldown das magias.
- Guarde habilidades para grupos de inimigos ou alvos fortes.
- Em encontros com dragoes, mantenha movimento lateral constante.
- Se a tela de missoes estiver aberta, feche antes de retomar combate/movimento total.

## Solucao de Problemas

- Tela em branco: verifique se esta abrindo por HTTP (nao por arquivo local).
- Baixa performance: feche abas pesadas e use navegador atualizado.
- Teclas nao respondem: clique na pagina do jogo para garantir foco.
- Atalho de dragao nao acionou: repita D, D e depois 1/2 com intervalo curto.

## Tecnologias

- Babylon.js
- JavaScript (ES6)
- HTML5
- CSS3

## Changelog

### 2026-06-01

- Manual do jogo expandido com instrucoes completas de uso.
- Controles de combate e habilidades documentados (F, Q, R, E e Space).
- Documentacao da UI de missoes e navegacao por teclado.
- Atalho de debug de spawn de dragoes atualizado para sequencia rapida:
	- D + D + 1 -> spawn do dragao de fogo
	- D + D + 2 -> spawn do dragao de vento
- Ajustes recentes de gameplay e visual com foco em dragoes estilizados 3D (fogo e vento).
