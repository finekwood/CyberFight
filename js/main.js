import { loadAssets, loadJson } from './assetLoader.js?v=aircraft-ui-v1';
import { CyberFlightGame, formatDistance, formatTime, resizeCanvas, toWorldPoint } from './game.js?v=aircraft-ui-v1';
import { PointerInput } from './input.js?v=aircraft-ui-v1';
import { loadRankings } from './ranking.js?v=aircraft-ui-v1';

const fallbackConfig = {
  canvas: { designWidth: 390, designHeight: 844 },
  ranking: { storageKey: 'cyber_flight_rankings_v1', limit: 20 },
  player: {},
  enemy: {},
  difficulty: [],
  skill: {}
};

const fallbackManifest = {
  basePath: 'assets/',
  assets: {},
  uiContract: { skillStates: ['disabled', 'ready', 'active', 'cooldown'] }
};

const dom = {
  screens: {
    home: document.getElementById('home-screen'),
    game: document.getElementById('game-screen'),
    over: document.getElementById('game-over-screen'),
    ranking: document.getElementById('ranking-screen')
  },
  fighterGrid: document.getElementById('fighter-grid'),
  startButton: document.getElementById('start-button'),
  rankingButton: document.getElementById('ranking-button'),
  canvas: document.getElementById('game-canvas'),
  hpFill: document.getElementById('hp-fill'),
  hpValue: document.getElementById('hp-value'),
  timeValue: document.getElementById('time-value'),
  distanceValue: document.getElementById('distance-value'),
  killValue: document.getElementById('kill-value'),
  levelValue: document.getElementById('level-value'),
  expFill: document.getElementById('exp-fill'),
  expValue: document.getElementById('exp-value'),
  skillButtons: Array.from(document.querySelectorAll('[data-skill]')),
  timeIcon: document.getElementById('time-icon'),
  scoreIcon: document.getElementById('score-icon'),
  rankIcon: document.getElementById('rank-icon'),
  resultTime: document.getElementById('result-time'),
  resultDistance: document.getElementById('result-distance'),
  resultScore: document.getElementById('result-score'),
  resultLevel: document.getElementById('result-level'),
  resultKill: document.getElementById('result-kill'),
  resultRank: document.getElementById('result-rank'),
  recordNote: document.getElementById('record-note'),
  retryButton: document.getElementById('retry-button'),
  overRankingButton: document.getElementById('over-ranking-button'),
  homeButton: document.getElementById('home-button'),
  rankingList: document.getElementById('ranking-list'),
  rankingRetryButton: document.getElementById('ranking-retry-button'),
  rankingHomeButton: document.getElementById('ranking-home-button')
};

let config;
let assets;
let game;
let selectedCharacter = 'white-dog';

init();

async function init() {
  [config, assets] = await Promise.all([
    loadJson('data/config.json', fallbackConfig),
    loadJson('data/asset-manifest.json', fallbackManifest).then(loadAssets)
  ]);

  resizeCanvas(dom.canvas, config.canvas.designWidth, config.canvas.designHeight);
  window.addEventListener('resize', () => resizeCanvas(dom.canvas, config.canvas.designWidth, config.canvas.designHeight));

  wireStaticAssets();
  renderFighterCards();
  renderRanking();
  bindActions();

  game = new CyberFlightGame({
    canvas: dom.canvas,
    config,
    assets,
    rankingConfig: config.ranking,
    hud: updateHud,
    onGameOver: showGameOver
  });
  game.input = new PointerInput(dom.canvas, (event) => toWorldPoint(dom.canvas, event));
}

function wireStaticAssets() {
  dom.timeIcon.src = assets.url('iconTime');
  dom.scoreIcon.src = assets.url('iconScore');
  dom.rankIcon.src = assets.url('iconRank');
  dom.skillButtons.forEach((button) => {
    const skill = config.skill[button.dataset.skill];
    const img = button.querySelector('img');
    const name = button.querySelector('.skill-name');
    if (img) img.src = assets.url(skill.iconAsset || skill.energyAsset);
    if (name) name.textContent = skill.buttonLabel || skill.label;
  });
}

function renderFighterCards() {
  dom.fighterGrid.innerHTML = '';
  Object.entries(config.player).forEach(([id, player]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `fighter-card${id === selectedCharacter ? ' is-selected' : ''}`;
    button.dataset.character = id;
    button.innerHTML = `
      <img src="${assets.url(player.avatarAsset)}" alt="${player.label}" />
      <div>
        <h3>${player.label}</h3>
        <p>${player.description}</p>
        <div class="stat-row">
          <span>HP ${player.hp}</span>
          <span>DMG ${player.damage}</span>
          <span>${config.skill[player.skillId]?.label || 'Skill'}</span>
        </div>
      </div>
    `;
    button.addEventListener('click', () => {
      selectedCharacter = id;
      renderFighterCards();
    });
    dom.fighterGrid.appendChild(button);
  });
}

function bindActions() {
  dom.startButton.addEventListener('click', startGame);
  dom.retryButton.addEventListener('click', startGame);
  dom.rankingRetryButton.addEventListener('click', startGame);
  dom.rankingButton.addEventListener('click', () => {
    renderRanking();
    showScreen('ranking');
  });
  dom.overRankingButton.addEventListener('click', () => {
    renderRanking();
    showScreen('ranking');
  });
  dom.homeButton.addEventListener('click', () => showScreen('home'));
  dom.rankingHomeButton.addEventListener('click', () => showScreen('home'));
  dom.skillButtons.forEach((button) => {
    button.addEventListener('click', () => game?.activateSkill(button.dataset.skill));
  });
}

function startGame() {
  game.start(selectedCharacter);
  showScreen('game');
}

function showScreen(name) {
  Object.entries(dom.screens).forEach(([key, screen]) => {
    screen.classList.toggle('is-active', key === name);
  });
}

function updateHud(state) {
  const hpPercent = Math.max(0, state.hp / state.maxHp) * 100;
  dom.hpFill.style.width = `${hpPercent}%`;
  dom.hpFill.style.background = hpPercent < 28
    ? 'linear-gradient(90deg, #ff5470, #ffe66b)'
    : 'linear-gradient(90deg, #55f58c, #3ee9ff)';
  dom.hpValue.textContent = `${Math.ceil(state.hp)}/${state.maxHp}`;
  dom.timeValue.textContent = formatTime(state.survivalTime);
  dom.distanceValue.textContent = formatDistance(state.distance);
  dom.levelValue.textContent = `LV${state.level}`;
  const isMaxLevel = state.level >= state.levelMax;
  dom.expFill.style.width = isMaxLevel ? '100%' : `${Math.min(100, (state.exp / state.expMax) * 100)}%`;
  dom.expValue.textContent = isMaxLevel ? 'MAX' : `EXP ${Math.floor(state.exp)}/${state.expMax}`;
  dom.killValue.textContent = `Kills ${state.killCount}`;

  dom.skillButtons.forEach((button) => {
    const skillState = state.skills[button.dataset.skill];
    if (!skillState) return;
    const label = button.querySelector('strong');
    button.dataset.state = skillState.state;
    button.disabled = !skillState.usable;
    if (skillState.state === 'active') {
      label.textContent = `${Math.ceil(skillState.activeRemainingTime)}s`;
    } else if (skillState.state === 'cooldown') {
      label.textContent = `CD ${Math.ceil(skillState.cooldownRemainingTime)}`;
    } else if (skillState.state === 'blocked') {
      label.textContent = 'FULL';
    } else if (skillState.state === 'ready') {
      label.textContent = 'READY';
    } else {
      label.textContent = `${Math.floor((skillState.energy / skillState.maxEnergy) * 100)}%`;
    }
  });
}

function showGameOver(result) {
  dom.resultDistance.textContent = formatDistance(result.entry.distance);
  dom.resultTime.textContent = formatTime(result.entry.time);
  dom.resultScore.textContent = String(result.entry.score);
  dom.resultLevel.textContent = `LV${result.entry.level || 1}`;
  dom.resultKill.textContent = String(result.entry.killCount);
  dom.resultRank.textContent = result.rank > 0 ? `#${result.rank}` : '-';
  dom.recordNote.textContent = result.isNewRecord
    ? 'New farthest flight record'
    : 'Keep pushing for a longer distance';
  renderRanking();
  showScreen('over');
}

function renderRanking() {
  const rows = loadRankings(config.ranking);
  dom.rankingList.innerHTML = '';
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-ranking';
    empty.textContent = 'No local records yet';
    dom.rankingList.appendChild(empty);
    return;
  }
  rows.forEach((row, index) => {
    const item = document.createElement('li');
    const label = config.player[row.character]?.label || row.character;
    item.innerHTML = `
      <strong>#${index + 1} ${label}</strong>
      <span>${formatDistance(row.distance)} - ${formatTime(row.time)} - ${row.killCount} K</span>
    `;
    dom.rankingList.appendChild(item);
  });
}
