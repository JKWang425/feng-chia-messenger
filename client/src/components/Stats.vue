<template>
  <div class="stats-container glass-panel">
    <h2>📊 校園即時通數據儀表板</h2>
    <div class="chart-wrapper">
      <Bar v-if="loaded" :data="chartData" :options="chartOptions" />
      <div v-else class="loading">載入圖表中...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = defineProps({
  posts: {
    type: Array,
    required: true
  }
});

const loaded = ref(false);
const chartData = ref({
  labels: [],
  datasets: [{ data: [] }]
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#e6e6e6' }
    }
  },
  scales: {
    x: { ticks: { color: '#e6e6e6' }, grid: { color: 'rgba(255,255,255,0.1)' } },
    y: { ticks: { color: '#e6e6e6', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } }
  }
};

onMounted(() => {
  // Aggregate data: post counts by author
  const authorCounts = {};
  props.posts.forEach(post => {
    authorCounts[post.author] = (authorCounts[post.author] || 0) + 1;
  });

  chartData.value = {
    labels: Object.keys(authorCounts),
    datasets: [
      {
        label: '發文數量',
        backgroundColor: '#f7a040',
        data: Object.values(authorCounts)
      }
    ]
  };
  loaded.value = true;
});
</script>

<style scoped>
.stats-container {
  padding: 30px;
  margin-top: 20px;
}
.stats-container h2 {
  text-align: center;
  margin-bottom: 20px;
  color: var(--primary-color);
}
.chart-wrapper {
  height: 300px;
  position: relative;
}
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--text-secondary);
}
</style>
