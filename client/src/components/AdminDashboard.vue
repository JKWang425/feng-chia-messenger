<template>
  <div class="admin-dashboard glass-panel animate-fade-in">
    <div class="dashboard-header">
      <h2>🛡️ 管理員後台</h2>
      <button class="btn-cancel" @click="$emit('close')">返回前台</button>
    </div>

    <div class="dashboard-content">
      <div class="section visits-section">
        <h3>網站每日流量</h3>
        <div class="chart-wrapper">
          <Bar v-if="loaded" :data="chartData" :options="chartOptions" />
          <div v-else class="loading">載入圖表中...</div>
        </div>
      </div>

      <div class="section users-section">
        <h3>使用者管理</h3>
        <table class="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>帳號</th>
              <th>身分</th>
              <th>註冊時間</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.username }}</td>
              <td><span :class="['role-badge', user.role]">{{ user.role === 'admin' ? '管理員' : '一般會員' }}</span></td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td>
                <button v-if="user.role !== 'admin'" class="btn-danger-sm" @click="deleteUser(user.id)">
                  刪除帳號
                </button>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td colspan="5" class="empty-state">尚無資料</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const emit = defineEmits(['close']);

const loaded = ref(false);
const users = ref([]);
const chartData = ref({ labels: [], datasets: [{ data: [] }] });

const chartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#e6e6e6' } } },
  scales: {
    x: { ticks: { color: '#e6e6e6' }, grid: { color: 'rgba(255,255,255,0.1)' } },
    y: { ticks: { color: '#e6e6e6', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } }
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const utcDateString = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
  return new Date(utcDateString).toLocaleDateString('zh-TW');
};

const fetchData = async () => {
  try {
    const [visitsRes, usersRes] = await Promise.all([
      axios.get('/api/admin/visits', { withCredentials: true }),
      axios.get('/api/admin/users', { withCredentials: true })
    ]);

    users.value = usersRes.data;

    const visits = visitsRes.data;
    chartData.value = {
      labels: visits.map(v => v.date),
      datasets: [{
        label: '每日造訪次數',
        backgroundColor: '#2ed573',
        data: visits.map(v => v.count)
      }]
    };
    loaded.value = true;
  } catch (err) {
    console.error("Error fetching admin data", err);
    alert('無法載入後台資料，請確認您具有管理員權限');
  }
};

const deleteUser = async (id) => {
  if (!confirm('確定要刪除這個使用者嗎？這將會連帶刪除他的所有貼文與留言！')) return;
  
  try {
    await axios.delete(`/api/admin/users/${id}`, { withCredentials: true });
    fetchData(); // reload users
  } catch (err) {
    console.error(err);
    alert('刪除失敗');
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.admin-dashboard { padding: 30px; margin-top: 20px; }
.dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid var(--card-border); padding-bottom: 16px; }
.dashboard-header h2 { color: var(--primary-color); }
.btn-cancel { background: transparent; border: 1px solid var(--text-secondary); color: var(--text-primary); padding: 8px 16px; border-radius: 6px; }
.btn-cancel:hover { background: rgba(255,255,255,0.1); }

.dashboard-content { display: flex; flex-direction: column; gap: 40px; }

.section h3 { margin-bottom: 16px; color: #fff; }
.chart-wrapper { height: 300px; position: relative; background: rgba(0,0,0,0.1); padding: 10px; border-radius: 8px; border: 1px solid var(--card-border); }

.users-table { width: 100%; border-collapse: collapse; background: rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
.users-table th, .users-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--card-border); }
.users-table th { background: rgba(255,255,255,0.05); font-weight: 600; color: var(--primary-color); }
.users-table tr:last-child td { border-bottom: none; }
.users-table tr:hover { background: rgba(255,255,255,0.02); }

.role-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
.role-badge.admin { background: rgba(247, 160, 64, 0.2); color: var(--primary-color); border: 1px solid rgba(247, 160, 64, 0.3); }
.role-badge.user { background: rgba(255, 255, 255, 0.1); color: var(--text-secondary); }

.btn-danger-sm { background: rgba(255, 71, 87, 0.2); color: var(--danger); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: 0.2s; font-size: 0.85rem; }
.btn-danger-sm:hover { background: var(--danger); color: #fff; }
</style>
