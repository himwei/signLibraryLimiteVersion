<script setup>
// ... (script 部分保持不变，因为它与样式无关)
import { ref, computed } from 'vue';
import {
  showToast,
  showLoadingToast,
  closeToast,
  showSuccessToast,
  showFailToast,
  showDialog
} from 'vant';

// --- 1. 状态定义 (对应 data()) ---
const selShow = ref(false); // 控制楼层选择弹窗显示
const selValue = ref('2楼北区'); // 当前选中的楼层
const inputNumber = ref(''); // 输入的座位号
const localData = ref([]); // 存储从 CDN 加载的 JSON 数据
const isFound = ref(false); // 是否找到座位及生成链接
const resultUrl = ref(''); // 生成的短链接
const loading = ref(false); // 防止重复点击

const themeColor = '#01BEFF'; // 定义主题色变量，方便 CSS 引用

// 原始 UniApp 的 list 数据，提取为 Vant Picker 的单列数据
const uniList = [
  {
    value: '1',
    label: '主校区',
    children: [
      { value: '1', label: '2楼北区' },
      { value: '2', label: '2楼环廊' },
    ]
  }
];

// 转换为 Vant Picker 的 columns 格式
const floorOptions = computed(() => {
  return uniList[0].children.map(child => ({
    text: child.label,
    value: child.label,
  }));
});

// 计算当前选中的 Picker 索引，用于初始化 Vant Picker 的选中项
const defaultPickerIndex = computed(() => {
  return floorOptions.value.findIndex(option => option.value === selValue.value);
});


// --- 2. 方法实现 (对应 methods()) ---

// 替换 uni.request/fetchJsonFromCdn
const fetchJsonFromCdn = async (floor) => {
  const urlMap = {
    '2楼北区': 'https://cdn.jsdelivr.net/gh/himwei/reserveLibary@main/json/2th_north_reserve_one_seat_clear_sorted_rev.json',
    '2楼环廊': 'https://cdn.jsdelivr.net/gh/himwei/reserveLibary@main/json/2th_round_reserve_one_seat_clear_sorted_rev.json',
  };
  const url = urlMap[floor];

  if (!url) {
    showFailToast('未知楼层');
    return [];
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('读取 JSON 失败:', error);
    showFailToast('读取失败或网络请求失败');
    return [];
  }
};

// Vant Picker 确认事件
const confirmSelection = ({ selectedOptions }) => {
  const selectedFloor = selectedOptions[0].value;
  selValue.value = selectedFloor;
  selShow.value = false;
  showToast(`已选择楼层：${selectedFloor}`);
  console.log('已选择楼层：', selectedFloor);
};

// 替换 uni.setClipboardData
const copyUrl = () => {
  if (!resultUrl.value) return;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(resultUrl.value)
        .then(() => {
          showSuccessToast('复制成功');
        })
        .catch(err => {
          console.error('复制失败: ', err);
          showFailToast('复制失败');
        });
  } else {
    showFailToast('浏览器不支持复制功能');
  }
};


// 替换 readAndParseJson
const readAndParseJson = async () => {
  if (loading.value) return;
  loading.value = true;
  isFound.value = false;
  resultUrl.value = '';

  // 1. 格式化座位号
  let numStr = String(inputNumber.value).trim();
  if (!numStr) {
    showFailToast('请输入座位号');
    loading.value = false;
    return;
  }
  while (numStr.length < 3) numStr = '0' + numStr;
  const formattedNumber = numStr;

  // 2. 加载 JSON 数据
  const loadToast = showLoadingToast({
    message: '正在加载座位数据...',
    forbidClick: true,
    duration: 0,
  });

  localData.value = await fetchJsonFromCdn(selValue.value);
  loadToast.close();
  if (!localData.value.length) {
    loading.value = false;
    return;
  }

  // 3. 构建搜索字符串
  const prefixMap = {
    '2楼北区': '2F-N',
    '2楼环廊': '2F-C',
  };
  const prefix = prefixMap[selValue.value] || '';
  if (!prefix) {
    showFailToast('未知楼层前缀');
    loading.value = false;
    return;
  }
  const searchStr = prefix + formattedNumber;

  // 4. 查找座位
  let foundItem = null;
  localData.value.forEach(item => {
    if (item.devName === searchStr) {
      foundItem = item;
    }
  });

  if (!foundItem) {
    showFailToast({ message: `未找到 ${searchStr}`, duration: 800 });
    loading.value = false;
    return;
  }

  // 5. 生成长链接
  const longUrl = `https://oneseat.zjhzu.edu.cn/scancode.html#/login?sta=1&sysid=1BC&lab=${foundItem.labId}&dev=${foundItem.devSn}`;

  // 6. 调用 Worker API 生成短链接
  const shortLinkToast = showLoadingToast({
    message: `正在找 ${searchStr}...`,
    forbidClick: true,
    duration: 0,
  });

  try {
    const workerUrl = '/api-shortlink/api'; // <--- 使用代理路径
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ originalUrl: longUrl}),
    });

    const resData = await response.json();

    if (response.ok && resData.shortLink) {
      resultUrl.value = resData.shortLink;
      isFound.value = true;
      showSuccessToast({message: `找到${searchStr}`, duration: 1000});
    } else {
      console.error('短链接 API 错误:', resData);
      // 如果短链接失败，可以显示原始长链接作为备用
      resultUrl.value = longUrl;
      isFound.value = true;
      showDialog({
        title: '短链接生成失败',
        message: '已使用原始链接作为结果。',
      });
    }

  } catch (err) {
    console.error('请求短链接失败:', err);
    resultUrl.value = longUrl; // 短链接失败时，仍然显示长链接
    isFound.value = true;
    showDialog({
      title: '短链接请求失败',
      message: '已使用原始链接作为结果。',
    });
  } finally {
    shortLinkToast.close();
    loading.value = false;
  }
};
</script>

<template>
  <div class="app-page-container">
    <div class="container">
      <!-- 楼层选择弹窗 - 替换 tn-select -->
      <van-popup v-model:show="selShow" position="bottom" round>
        <!-- Vant Picker 用于选择楼层，单列模式 -->
        <van-picker
            :columns="floorOptions"
            :default-index="defaultPickerIndex"
            title="选择楼层"
            @confirm="confirmSelection"
            @cancel="selShow = false"
        >
          <!-- 确保 Vant Picker 的确认按钮使用主题色 -->
          <template #confirm-button>
            <van-button :color="themeColor" block>确认</van-button>
          </template>
        </van-picker>
      </van-popup>

      <!-- 点击设定楼层按钮 - 替换 tn-button -->
      <van-button
          type="primary"
          size="large"
          @click="selShow = true"
          :color="themeColor"
          class="modern-button"
          style="margin-bottom: 20px;"
      >
        点击设定楼层
      </van-button>

      <div class="floor-display">
        当前楼层: <strong class="floor-value">{{ selValue }}</strong>
      </div>

      <!-- 座位号输入框 - 替换 tn-input -->
      <!-- Vant Field 默认样式已经不错，这里主要通过 style 调整间距和 label -->
      <van-field
          v-model="inputNumber"
          placeholder="请输入数字座位号 例如123或1(会整理为001)"
          clearable
          :border="true"
          type="number"
          label="座位号"
          maxlength="3"
          class="input-box"
      />

      <!-- 生成链接按钮 - 替换 tn-button -->
      <van-button
          type="primary"
          size="large"
          @click="readAndParseJson"
          :loading="loading"
          :disabled="loading || !inputNumber"
          :color="themeColor"
          class="modern-button"
          style="margin-bottom: 20px;"
      >
        生成签到链接
      </van-button>

      <!-- 结果显示区域 -->
      <div v-if="isFound" class="result-area modern-card">
        <!-- 链接显示 -->
        <p class="result-url">{{ resultUrl }}</p>

        <!-- 复制链接按钮 - 替换 tn-button -->
        <van-button
            type="primary"
            size="large"
            @click="copyUrl"
            :color="themeColor"
            class="modern-button"
        >
          点击复制链接
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 使用 v-bind 绑定 themeColor */
.result-url {
  color: v-bind(themeColor) !important;
}

.floor-value {
  color: v-bind(themeColor);
}

/* 全局页面容器，增加轻微背景色以提升层次感 */
.app-page-container {
  min-height: 100vh;
  background-color: #f7f8fa; /* 浅灰色背景 */
}

.container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
  background-color: #ffffff; /* 内容区使用白色背景 */
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); /* 柔和的阴影 */
  height: 100vh;

}

/* 现代按钮样式：圆角和细微过渡 */
.modern-button {
  border-radius: 8px; /* 更圆润的按钮 */
  transition: transform 0.2s ease;
}

.modern-button:active {
  transform: scale(0.99); /* 轻微的点击反馈 */
}

/* 楼层显示优化 */
.floor-display {
  padding: 10px 0;
  margin-bottom: 15px;
  text-align: center;
  font-size: 16px;
  color: #666; /* 柔和的字体颜色 */
  font-weight: 500;
  border-bottom: 1px dashed #eee; /* 增加分隔线 */
}

.floor-value {
  font-size: 18px;
  font-weight: bold;
  margin-left: 5px;
}

/* 输入框优化 */
.input-box {
  margin: 20px 0 !important;
  border-radius: 8px;
  overflow: hidden; /* 配合圆角 */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); /* 轻微阴影 */
}

/* 覆盖 Vant Field 的边框样式 */
:deep(.input-box .van-field__control) {
  padding-left: 5px;
}

/* 结果区域优化：卡片化和突出显示 */
.result-area {
  margin-top: 30px;
  padding: 20px 15px;
  border: 1px solid #ebedf0; /* 柔和的边框 */
  border-radius: 10px; /* 圆角 */
  background-color: #ffffff; /* 确保背景是白色 */
  box-shadow: 0 6px 20px rgba(1, 190, 255, 0.1); /* 使用主题色系的柔和阴影 */
  text-align: center;
}

.result-url {
  word-break: break-all;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 20px;
  padding: 5px;
  border-bottom: 1px dotted #ccc; /* 链接底部虚线 */
}
</style>
