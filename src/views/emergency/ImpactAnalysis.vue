<!--
  ImpactAnalysis.vue — 应急事件影响范围分析
  · 按事件等级确定性映射影响面：影响户数 / 影响人口 / 涉及嘎查村 / 预计修复时长
  · 恢复进度按事件状态推进（未签收 5% → 已销号 100%）
  · 影响半径相对最大 6km 归一展示（牧区旗县口径）
-->
<template>
  <div class="impact">
    <template v-if="event">
      <div class="igrid">
        <div class="ig">
          <b class="num">{{ spec.households }}</b>
          <span>影响户数</span>
        </div>
        <div class="ig">
          <b class="num">{{ spec.population }}</b>
          <span>影响人口</span>
        </div>
        <div class="ig">
          <b class="num">{{ spec.villages }}</b>
          <span>涉及嘎查村</span>
        </div>
        <div class="ig">
          <b class="num">{{ spec.repairHours }}</b>
          <span>预计修复 h</span>
        </div>
      </div>

      <div class="bars">
        <MicroBar
          label="影响半径"
          :value="spec.radiusKm"
          :max="6"
          unit=" km"
          :decimals="1"
          color="var(--flood-teal)"
        />
        <MicroBar
          label="恢复进度"
          :value="progress"
          :max="100"
          unit="%"
          :decimals="0"
          :color="progressColor"
        />
      </div>
    </template>
    <div v-else class="empty">选择事件后展示影响范围评估</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EmergencyEvent } from '@shared/types';
import MicroBar from '@charts/MicroBar.vue';

const props = defineProps<{
  event: EmergencyEvent | null;
}>();

interface ImpactSpec {
  households: number;
  population: number;
  villages: number;
  repairHours: number;
  radiusKm: number;
}

/** 等级 → 影响面（牧区旗县行业口径，mock 基准） */
const BY_LEVEL: Record<EmergencyEvent['level'], ImpactSpec> = {
  重大: { households: 3200, population: 8300, villages: 4, repairHours: 8, radiusKm: 6.0 },
  较大: { households: 850, population: 2200, villages: 2, repairHours: 4, radiusKm: 2.5 },
  一般: { households: 120, population: 310, villages: 1, repairHours: 2, radiusKm: 1.0 },
};

/** 状态 → 恢复进度 % */
const PROGRESS: Record<EmergencyEvent['status'], number> = {
  未签收: 5,
  已派单: 20,
  已签收: 55,
  已销号: 100,
};

const PROGRESS_COLOR: Record<EmergencyEvent['status'], string> = {
  未签收: 'var(--status-alarm)',
  已派单: 'var(--steppe-amber)',
  已签收: 'var(--flood-teal)',
  已销号: 'var(--spring-green)',
};

const spec = computed<ImpactSpec>(() => BY_LEVEL[props.event?.level ?? '一般']);
const progress = computed(() => (props.event ? PROGRESS[props.event.status] : 0));
const progressColor = computed(() =>
  props.event ? PROGRESS_COLOR[props.event.status] : 'var(--flood-teal)',
);
</script>

<style scoped>
.impact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.igrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.ig {
  text-align: center;
  padding: 7px 2px 6px;
  background: rgba(12, 35, 64, 0.5);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
}
.ig b {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: var(--flood-teal);
  line-height: 1.15;
}
.ig:nth-child(2) b { color: var(--steppe-amber); }
.ig:nth-child(4) b { color: var(--status-alarm); }
.ig span {
  display: block;
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
  white-space: nowrap;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 13px;
  opacity: 0.75;
  min-height: 64px;
}
</style>
