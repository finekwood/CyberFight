import { formatDistance, formatTime, saveRanking } from './ranking.js?v=aircraft-ui-v1';

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const SKILL_IDS = ['attack', 'heal', 'shield'];

export class CyberFlightGame {
  constructor({ canvas, config, assets, hud, rankingConfig, onGameOver }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    this.assets = assets;
    this.hud = hud;
    this.rankingConfig = rankingConfig;
    this.onGameOver = onGameOver;
    this.state = 'idle';
    this.lastTime = 0;
    this.selectedCharacter = 'white-dog';
    this.resetRuntime();
  }

  start(characterId) {
    this.selectedCharacter = characterId;
    this.resetRuntime();
    this.state = 'playing';
    this.lastTime = performance.now();
    this.updateHud();
    this.render();
    requestAnimationFrame((time) => this.loop(time));
  }

  resetRuntime() {
    const playerConfig = this.config.player[this.selectedCharacter] || this.config.player['white-dog'];
    this.elapsedTime = 0;
    this.score = 0;
    this.killCount = 0;
    this.level = 1;
    this.exp = 0;
    this.lastDamageTime = -Infinity;
    this.spawnTimer = 0;
    this.backgroundY = 0;
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.drops = [];
    this.effects = [];
    this.player = {
      character: this.selectedCharacter,
      asset: playerConfig.aircraftAsset,
      assetsByLevel: playerConfig.aircraftAssets || {},
      x: DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT - 190,
      width: 72,
      height: 88,
      hp: playerConfig.hp,
      maxHp: playerConfig.hp,
      speed: playerConfig.speed,
      damage: playerConfig.damage,
      fireRate: playerConfig.fireRate,
      fireTimer: 0,
      skills: createSkillRuntime(this.config.skill),
      invincible: false,
      attackBoost: false
    };
  }

  loop(time) {
    if (this.state !== 'playing') return;
    const delta = Math.min((time - this.lastTime) / 1000, 0.033);
    this.lastTime = time;
    this.update(delta);
    this.render();
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(delta) {
    this.elapsedTime += delta;
    this.backgroundY = (this.backgroundY + 105 * delta) % this.getBackgroundLoopHeight();
    this.updatePlayer(delta);
    this.updateSkills(delta);
    this.updateSpawning(delta);
    this.updateEnemies(delta);
    this.updateBullets(delta);
    this.updateDrops(delta);
    this.updateEffects(delta);
    this.resolveCollisions();
    this.cleanup();
    this.updateHud();
    if (this.player.hp <= 0) this.finishRun();
  }

  updatePlayer(delta) {
    const input = this.input;
    if (input?.target) {
      const dx = input.target.x - this.player.x;
      const dy = input.target.y - this.player.y;
      const maxMove = this.player.speed * delta;
      const distance = Math.hypot(dx, dy);
      const ratio = distance > maxMove ? maxMove / distance : 1;
      this.player.x += dx * ratio;
      this.player.y += dy * ratio;
    }

    const halfW = this.player.width / 2;
    const halfH = this.player.height / 2;
    this.player.x = clamp(this.player.x, halfW + 8, DESIGN_WIDTH - halfW - 8);
    this.player.y = clamp(this.player.y, DESIGN_HEIGHT * 0.42, DESIGN_HEIGHT - halfH - 118);

    const levelConfig = this.getLevelConfig();
    const fireRate = this.isSkillActive('attack')
      ? this.player.fireRate * 0.72
      : this.player.fireRate;
    this.player.fireTimer -= delta;
    if (this.player.fireTimer <= 0) {
      this.spawnPlayerBullet();
      this.player.fireTimer = fireRate * (levelConfig.fireRateMultiplier || 1);
    }
  }

  updateSkills(delta) {
    SKILL_IDS.forEach((skillId) => {
      const runtime = this.player.skills[skillId];
      const config = this.config.skill[skillId];
      if (!runtime || !config) return;

      if (runtime.activeRemainingTime > 0) {
        runtime.activeRemainingTime = Math.max(0, runtime.activeRemainingTime - delta);
        if (runtime.activeRemainingTime === 0) {
          this.finishActiveSkill(skillId);
          runtime.cooldownRemainingTime = config.cooldown || 0;
        }
      } else if (runtime.cooldownRemainingTime > 0) {
        runtime.cooldownRemainingTime = Math.max(0, runtime.cooldownRemainingTime - delta);
      }

      runtime.state = this.getSkillState(skillId);
    });
  }

  activateSkill(skillId) {
    const runtime = this.player.skills[skillId];
    const config = this.config.skill[skillId];
    if (this.state !== 'playing' || !runtime || !config || !this.canActivateSkill(skillId)) return;

    runtime.energy = 0;
    if (skillId === 'attack') {
      this.clearBattlefield();
      this.player.attackBoost = true;
      runtime.activeRemainingTime = config.duration;
    } else if (skillId === 'heal') {
      this.player.hp = Math.min(
        this.player.maxHp,
        this.player.hp + this.player.maxHp * config.healMaxHpRatio
      );
      runtime.cooldownRemainingTime = config.cooldown;
    } else if (skillId === 'shield') {
      this.player.invincible = true;
      runtime.activeRemainingTime = config.duration;
    }

    runtime.state = this.getSkillState(skillId);
    this.updateHud();
  }

  finishActiveSkill(skillId) {
    if (skillId === 'attack') this.player.attackBoost = false;
    if (skillId === 'shield') this.player.invincible = false;
  }

  canActivateSkill(skillId) {
    const runtime = this.player.skills[skillId];
    if (!runtime || runtime.energy < runtime.maxEnergy) return false;
    if (runtime.activeRemainingTime > 0 || runtime.cooldownRemainingTime > 0) return false;
    if (skillId === 'heal' && this.player.hp >= this.player.maxHp) return false;
    return true;
  }

  getSkillState(skillId) {
    const runtime = this.player.skills[skillId];
    if (!runtime) return 'charging';
    if (runtime.activeRemainingTime > 0) return 'active';
    if (runtime.cooldownRemainingTime > 0) return 'cooldown';
    if (runtime.energy >= runtime.maxEnergy) {
      return skillId === 'heal' && this.player.hp >= this.player.maxHp ? 'blocked' : 'ready';
    }
    return 'charging';
  }

  isSkillActive(skillId) {
    return (this.player.skills[skillId]?.activeRemainingTime || 0) > 0;
  }

  updateSpawning(delta) {
    this.spawnTimer -= delta;
    const difficulty = this.getDifficulty();
    if (this.spawnTimer > 0) return;
    this.spawnEnemy(difficulty);
    this.spawnTimer = difficulty.spawnInterval;
  }

  getDifficulty() {
    return this.config.difficulty
      .filter((entry) => this.elapsedTime >= entry.from)
      .at(-1) || this.config.difficulty[0];
  }

  spawnEnemy(difficulty) {
    const type = pick(difficulty.enemyTypes);
    const base = this.config.enemy[type];
    const size = type === 'medium' ? 72 : 48;
    const x = random(size / 2 + 12, DESIGN_WIDTH - size / 2 - 12);
    const movement = base.movement || { pattern: 'straight' };
    const movePattern = pick(movement.patterns || [movement.pattern || 'straight']);
    const amplitude = random(movement.amplitudeMin || 0, movement.amplitudeMax || 0);
    const hoverY = random(movement.hoverYMin || 0, movement.hoverYMax || 0);
    const fireChance = difficulty.fireChance?.[type] ?? base.fireChance ?? 1;
    this.enemies.push({
      id: `enemy_${Date.now()}_${Math.random()}`,
      type,
      asset: base.asset,
      x,
      originX: x,
      y: -size,
      width: size,
      height: size,
      hp: base.hp,
      maxHp: base.hp,
      speed: base.speed * difficulty.speedMultiplier,
      score: base.score,
      damage: base.damage,
      fireRate: Math.random() <= fireChance ? base.fireRate : 0,
      fireTimer: base.fireRate ? random(0.8, base.fireRate) : 0,
      bulletPattern: base.bulletPattern || { type: 'straight', speed: 210 },
      movePattern,
      moveAmplitude: amplitude,
      moveFrequency: random(movement.frequencyMin || 0, movement.frequencyMax || 0),
      movePhase: random(0, Math.PI * 2),
      driftX: random(movement.driftMin || 0, movement.driftMax || 0),
      trackStrength: movement.trackStrength || 0,
      hoverY,
      hoverRemainingTime: random(movement.hoverDurationMin || 0, movement.hoverDurationMax || 0),
      energyChance: base.energyChance
    });
  }

  spawnPlayerBullet() {
    const levelConfig = this.getLevelConfig();
    const damageMultiplier = this.isSkillActive('attack')
      ? this.config.skill.attack.damageMultiplier || 1
      : 1;
    const bulletOffsets = getBulletOffsets(Math.max(
      levelConfig.bulletCount || 1,
      this.isSkillActive('attack') ? 2 : 1
    ));
    const levelDamageMultiplier = levelConfig.damageMultiplier || 1;
    bulletOffsets.forEach((offset) => {
      this.playerBullets.push({
        x: this.player.x + offset,
        y: this.player.y - this.player.height / 2 + 6,
        width: 10,
        height: 24,
        damage: this.player.damage * levelDamageMultiplier * damageMultiplier,
        vy: -670,
        vx: offset * 2.2
      });
    });
  }

  updateEnemies(delta) {
    this.enemies.forEach((enemy) => {
      this.updateEnemyMovement(enemy, delta);
      if (enemy.fireRate > 0) {
        enemy.fireTimer -= delta;
        if (enemy.fireTimer <= 0 && enemy.y > 20 && enemy.y < DESIGN_HEIGHT * 0.72) {
          this.spawnEnemyBullets(enemy);
          enemy.fireTimer = enemy.fireRate;
        }
      }
    });
  }

  updateEnemyMovement(enemy, delta) {
    const wave = Math.sin(this.elapsedTime * Math.PI * 2 * enemy.moveFrequency + enemy.movePhase);
    let nextY = enemy.y + enemy.speed * delta;
    let nextX = enemy.x;

    if (enemy.movePattern === 'sway') {
      nextX = enemy.originX + wave * enemy.moveAmplitude;
    } else if (enemy.movePattern === 'zigzag') {
      nextX = enemy.originX + Math.sign(wave || 1) * enemy.moveAmplitude;
    } else if (enemy.movePattern === 'diagonal') {
      nextX = enemy.x + enemy.driftX * delta;
    } else if (enemy.movePattern === 'patrol') {
      nextX = enemy.originX + wave * enemy.moveAmplitude;
    } else if (enemy.movePattern === 'pressure') {
      const targetX = this.player?.x ?? enemy.originX;
      nextX = moveToward(enemy.x, targetX, enemy.trackStrength * delta);
      nextX += wave * enemy.moveAmplitude * 0.25;
    } else if (enemy.movePattern === 'hover') {
      if (enemy.y >= enemy.hoverY && enemy.hoverRemainingTime > 0) {
        enemy.hoverRemainingTime = Math.max(0, enemy.hoverRemainingTime - delta);
        nextY = enemy.y + enemy.speed * 0.18 * delta;
      }
      nextX = enemy.originX + wave * enemy.moveAmplitude;
    }

    enemy.x = clamp(nextX, enemy.width / 2 + 8, DESIGN_WIDTH - enemy.width / 2 - 8);
    enemy.y = nextY;
  }

  spawnEnemyBullets(enemy) {
    const pattern = enemy.bulletPattern || { type: 'straight', speed: 210 };
    const angles = pattern.type === 'spread' || pattern.type === 'aimed-spread' ? pattern.angles : [0];
    const speed = pattern.speed || 210;
    angles.forEach((angle) => {
      const aimAngle = pattern.type === 'aimed-spread'
        ? clamp(
          Math.atan2((this.player?.x ?? enemy.x) - enemy.x, DESIGN_HEIGHT) * 180 / Math.PI,
          -(pattern.aimLimit || 30),
          pattern.aimLimit || 30
        )
        : 0;
      const radian = ((angle + aimAngle) * Math.PI) / 180;
      this.enemyBullets.push({
        x: enemy.x,
        y: enemy.y + enemy.height / 2,
        width: 12,
        height: 12,
        damage: pattern.damage || 14,
        vx: Math.sin(radian) * speed,
        vy: Math.cos(radian) * speed
      });
    });
  }

  updateBullets(delta) {
    this.playerBullets.forEach((bullet) => {
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
    });
    this.enemyBullets.forEach((bullet) => {
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
    });
  }

  updateDrops(delta) {
    this.drops.forEach((drop) => {
      drop.y += drop.speed * delta;
    });
  }

  updateEffects(delta) {
    this.effects.forEach((effect) => {
      effect.life -= delta;
      effect.scale += delta * 1.2;
    });
  }

  resolveCollisions() {
    this.playerBullets.forEach((bullet) => {
      this.enemies.forEach((enemy) => {
        if (bullet.dead || enemy.dead || !intersects(bullet, enemy)) return;
        bullet.dead = true;
        enemy.hp -= bullet.damage;
        if (enemy.hp <= 0) this.killEnemy(enemy);
      });
    });

    this.enemies.forEach((enemy) => {
      if (enemy.dead || !intersects(this.player, enemy)) return;
      if (this.isSkillActive('shield') && enemy.type === 'small') {
        this.killEnemy(enemy);
        return;
      }
      enemy.dead = true;
      this.damagePlayer(enemy.damage);
      this.addExplosion(enemy.x, enemy.y);
    });

    this.enemyBullets.forEach((bullet) => {
      if (bullet.dead || !intersects(this.player, bullet)) return;
      bullet.dead = true;
      this.damagePlayer(bullet.damage);
    });

    this.drops.forEach((drop) => {
      if (drop.dead || !intersects(this.player, drop)) return;
      drop.dead = true;
      this.score += drop.score;
      this.addSkillEnergy(drop.type, drop.value);
    });
  }

  killEnemy(enemy) {
    enemy.dead = true;
    this.killCount += 1;
    this.score += enemy.score;
    this.addExp(enemy.type);
    this.addExplosion(enemy.x, enemy.y);
    if (Math.random() <= enemy.energyChance) this.spawnEnergyDrop(enemy);
  }

  addExp(enemyType) {
    const leveling = this.config.leveling;
    if (!leveling || this.level >= leveling.maxLevel) return;
    this.exp += leveling.enemyExp?.[enemyType] || 0;
    while (this.exp >= this.getExpToNextLevel() && this.level < leveling.maxLevel) {
      this.exp -= this.getExpToNextLevel();
      this.level += 1;
      this.addLevelUpEffect();
    }
    if (this.level >= leveling.maxLevel) this.exp = Math.min(this.exp, this.getExpToNextLevel());
  }

  addLevelUpEffect() {
    this.effects.push({
      x: this.player.x,
      y: this.player.y,
      life: 0.55,
      maxLife: 0.55,
      scale: 1.1,
      color: '#3ee9ff'
    });
  }

  clearBattlefield() {
    this.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      enemy.dead = true;
      this.killCount += 1;
      this.score += enemy.score;
      this.addExp(enemy.type);
      this.addExplosion(enemy.x, enemy.y);
    });
    this.enemyBullets = [];
  }

  spawnEnergyDrop(enemy) {
    const type = this.chooseEnergyType(enemy);
    const skill = this.config.skill[type];
    const dropConfig = {
      attack: { speed: 145, score: 20, width: 30, height: 30 },
      heal: { speed: 125, score: 10, width: 32, height: 32 },
      shield: { speed: 135, score: 15, width: 30, height: 30 }
    }[type];
    this.drops.push({
      type,
      asset: skill.energyAsset,
      x: enemy.x,
      y: enemy.y,
      width: dropConfig.width,
      height: dropConfig.height,
      speed: dropConfig.speed,
      value: skill.energyValue || 10,
      score: dropConfig.score
    });
  }

  chooseEnergyType(enemy) {
    const weights = enemy.type === 'medium'
      ? { attack: 40, heal: 25, shield: 35 }
      : { attack: 60, heal: 20, shield: 20 };
    if (this.player.hp / this.player.maxHp < 0.35) weights.heal += 25;
    if (this.enemies.filter((item) => !item.dead).length >= 5) weights.attack += 15;
    if (this.elapsedTime - this.lastDamageTime <= 8) weights.shield += 20;
    SKILL_IDS.forEach((skillId) => {
      if ((this.player.skills[skillId]?.energy || 0) >= (this.player.skills[skillId]?.maxEnergy || 100)) {
        weights[skillId] *= 0.6;
      }
    });
    const total = weights.attack + weights.heal + weights.shield;
    let roll = Math.random() * total;
    for (const skillId of SKILL_IDS) {
      roll -= weights[skillId];
      if (roll <= 0) return skillId;
    }
    return 'attack';
  }

  addSkillEnergy(skillId, amount) {
    const runtime = this.player.skills[skillId];
    if (!runtime) return;
    runtime.energy = Math.min(runtime.maxEnergy, runtime.energy + amount);
    runtime.state = this.getSkillState(skillId);
  }

  addExplosion(x, y) {
    this.effects.push({ x, y, life: 0.28, maxLife: 0.28, scale: 0.7 });
  }

  damagePlayer(amount) {
    if (this.player.invincible) return;
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.lastDamageTime = this.elapsedTime;
  }

  cleanup() {
    this.enemies = this.enemies.filter((enemy) => !enemy.dead && enemy.y < DESIGN_HEIGHT + 90);
    this.playerBullets = this.playerBullets.filter((bullet) => !bullet.dead && bullet.y > -40);
    this.enemyBullets = this.enemyBullets.filter((bullet) => (
      !bullet.dead &&
      bullet.y < DESIGN_HEIGHT + 40 &&
      bullet.x > -40 &&
      bullet.x < DESIGN_WIDTH + 40
    ));
    this.drops = this.drops.filter((drop) => !drop.dead && drop.y < DESIGN_HEIGHT + 40);
    this.effects = this.effects.filter((effect) => effect.life > 0);
  }

  finishRun() {
    this.state = 'game_over';
    const distance = this.getDistance();
    const entry = {
      id: `run_${Date.now()}`,
      playerName: 'Player001',
      character: this.selectedCharacter,
      time: Math.floor(this.elapsedTime),
      distance,
      score: this.getTotalScore(),
      combatScore: Math.floor(this.score),
      level: this.level,
      killCount: this.killCount,
      bossKillCount: 0,
      createdAt: new Date().toISOString()
    };
    const result = saveRanking(this.rankingConfig, entry);
    this.onGameOver({ entry, ...result });
  }

  updateHud() {
    const player = this.player;
    this.hud({
      hp: player.hp,
      maxHp: player.maxHp,
      survivalTime: this.elapsedTime,
      distance: this.getDistance(),
      score: this.getTotalScore(),
      killCount: this.killCount,
      level: this.level,
      levelMax: this.config.leveling?.maxLevel || this.level,
      exp: this.exp,
      expMax: this.getExpToNextLevel(),
      skills: this.getHudSkills()
    });
  }

  getLevelConfig() {
    return this.config.leveling?.levels?.[String(this.level)] || {};
  }

  getExpToNextLevel() {
    const leveling = this.config.leveling;
    if (!leveling) return 100;
    return leveling.expToNext?.[String(this.level)] || leveling.expToNext?.[String(this.level - 1)] || 100;
  }

  getDistance() {
    const distancePerSecond = this.rankingConfig.distancePerSecond || 100;
    return Math.floor(this.elapsedTime * distancePerSecond);
  }

  getTotalScore() {
    return this.getDistance() + Math.floor(this.score);
  }

  getHudSkills() {
    return Object.fromEntries(SKILL_IDS.map((skillId) => {
      const runtime = this.player.skills[skillId];
      runtime.state = this.getSkillState(skillId);
      return [skillId, {
        energy: runtime.energy,
        maxEnergy: runtime.maxEnergy,
        state: runtime.state,
        activeRemainingTime: runtime.activeRemainingTime,
        cooldownRemainingTime: runtime.cooldownRemainingTime,
        usable: this.canActivateSkill(skillId)
      }];
    }));
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.drawBackground(ctx);
    this.drawDrops(ctx);
    this.drawBullets(ctx);
    this.drawEnemies(ctx);
    this.drawPlayer(ctx);
    this.drawEffects(ctx);
  }

  drawBackground(ctx) {
    const loopBg = this.assets.get('stage1BgLoop');
    if (loopBg) {
      const h = this.getBackgroundLoopHeight();
      const y = this.backgroundY;
      drawImageOrFallback(ctx, loopBg, 0, y - h, DESIGN_WIDTH, h, '#07111f');
      drawImageOrFallback(ctx, loopBg, 0, y, DESIGN_WIDTH, h, '#07111f');
      this.drawGameplayDepthOverlay(ctx);
      return;
    }

    const bg1 = this.assets.get('stage1Bg01');
    const bg2 = this.assets.get('stage1Bg02');
    const y = this.backgroundY;
    drawImageOrFallback(ctx, bg1, 0, y - DESIGN_HEIGHT, DESIGN_WIDTH, DESIGN_HEIGHT, '#071629');
    drawImageOrFallback(ctx, bg2, 0, y, DESIGN_WIDTH, DESIGN_HEIGHT, '#091222');
    this.drawGameplayDepthOverlay(ctx);
  }

  getBackgroundLoopHeight() {
    const loopBg = this.assets.get('stage1BgLoop');
    if (!loopBg?.naturalWidth || !loopBg?.naturalHeight) return DESIGN_HEIGHT;
    return Math.max(DESIGN_HEIGHT, (loopBg.naturalHeight / loopBg.naturalWidth) * DESIGN_WIDTH);
  }

  drawGameplayDepthOverlay(ctx) {
    const topFade = ctx.createLinearGradient(0, 0, 0, 140);
    topFade.addColorStop(0, 'rgba(0, 5, 14, 0.62)');
    topFade.addColorStop(1, 'rgba(0, 5, 14, 0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, DESIGN_WIDTH, 140);

    const bottomFade = ctx.createLinearGradient(0, DESIGN_HEIGHT - 180, 0, DESIGN_HEIGHT);
    bottomFade.addColorStop(0, 'rgba(0, 5, 14, 0)');
    bottomFade.addColorStop(1, 'rgba(0, 5, 14, 0.72)');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, DESIGN_HEIGHT - 180, DESIGN_WIDTH, 180);

    const sideFade = ctx.createLinearGradient(0, 0, DESIGN_WIDTH, 0);
    sideFade.addColorStop(0, 'rgba(0, 4, 12, 0.62)');
    sideFade.addColorStop(0.18, 'rgba(0, 4, 12, 0)');
    sideFade.addColorStop(0.82, 'rgba(0, 4, 12, 0)');
    sideFade.addColorStop(1, 'rgba(0, 4, 12, 0.62)');
    ctx.fillStyle = sideFade;
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  }

  drawPlayer(ctx) {
    const player = this.player;
    const img = this.assets.get(this.getPlayerAircraftAsset());
    const size = this.getPlayerDrawSize();
    drawCentered(ctx, img, player.x, player.y, size.width, size.height, '#3ee9ff');
    if (player.invincible) {
      const shield = this.assets.get('skillShield');
      ctx.globalAlpha = 0.72;
      drawCentered(ctx, shield, player.x, player.y, 118, 118, '#55f58c');
      ctx.globalAlpha = 1;
    }
    if (this.isSkillActive('attack')) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = '#ffe66b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 58 + Math.sin(this.elapsedTime * 12) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawEnemies(ctx) {
    this.enemies.forEach((enemy) => {
      drawCentered(ctx, this.assets.get(enemy.asset), enemy.x, enemy.y, enemy.width, enemy.height, '#ff5470');
      const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2 - 8, enemy.width, 4);
      ctx.fillStyle = '#ff5470';
      ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2 - 8, enemy.width * ratio, 4);
    });
  }

  drawBullets(ctx) {
    this.playerBullets.forEach((bullet) => {
      drawCentered(ctx, this.assets.get('playerBullet'), bullet.x, bullet.y, bullet.width, bullet.height, '#55f58c');
    });
    this.enemyBullets.forEach((bullet) => {
      drawCentered(ctx, this.assets.get('enemyBulletStraight'), bullet.x, bullet.y, bullet.width, bullet.height, '#ff5470');
    });
  }

  drawDrops(ctx) {
    this.drops.forEach((drop) => {
      drawCentered(ctx, this.assets.get(drop.asset), drop.x, drop.y, drop.width, drop.height, '#ffe66b');
    });
  }

  drawEffects(ctx) {
    this.effects.forEach((effect) => {
      const alpha = clamp(effect.life / effect.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      drawCentered(
        ctx,
        this.assets.get('explosionSmall'),
        effect.x,
        effect.y,
        80 * effect.scale,
        80 * effect.scale,
        effect.color || '#ffe66b'
      );
      ctx.globalAlpha = 1;
    });
  }

  getPlayerAircraftAsset() {
    return this.player.assetsByLevel?.[String(this.level)] || this.player.asset;
  }

  getPlayerDrawSize() {
    const sizes = {
      1: { width: 72, height: 88 },
      2: { width: 118, height: 88 },
      3: { width: 156, height: 88 }
    };
    return sizes[this.level] || sizes[1];
  }
}

export function resizeCanvas(canvas, width = DESIGN_WIDTH, height = DESIGN_HEIGHT) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function toWorldPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * DESIGN_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * DESIGN_HEIGHT
  };
}

function drawCentered(ctx, img, x, y, width, height, color) {
  drawImageOrFallback(ctx, img, x - width / 2, y - height / 2, width, height, color);
}

function drawImageOrFallback(ctx, img, x, y, width, height, color) {
  if (img && img.complete && img.naturalWidth !== 0) {
    ctx.drawImage(img, x, y, width, height);
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function createSkillRuntime(skillConfig) {
  return Object.fromEntries(SKILL_IDS.map((skillId) => {
    const config = skillConfig[skillId];
    return [skillId, {
      energy: 0,
      maxEnergy: config.maxEnergy,
      state: 'charging',
      activeRemainingTime: 0,
      cooldownRemainingTime: 0
    }];
  }));
}

function intersects(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function moveToward(value, target, amount) {
  if (value < target) return Math.min(target, value + amount);
  if (value > target) return Math.max(target, value - amount);
  return value;
}

function getBulletOffsets(count) {
  if (count <= 1) return [0];
  if (count === 2) return [-13, 13];
  return [-18, 0, 18];
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export { formatDistance, formatTime };
