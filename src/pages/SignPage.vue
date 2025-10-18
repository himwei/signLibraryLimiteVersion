<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  showFailToast,
  showDialog
} from 'vant';

// --- 1. 状态定义 (对应 data()) ---
const selShow = ref(false); // 控制楼层选择弹窗显示
const selValue = ref('2楼北区'); // 当前选中的楼层 (初始值)
const inputNumber = ref(''); // 输入的座位号
const redemptionCode = ref(''); // 兑换码输入
const localData = ref([]); // 存储从 CDN 加载的 JSON 数据
const isFound = ref(false); // 是否找到座位及生成链接
const resultUrl = ref(''); // 生成的短链接
const loading = ref(false); // 防止重复点击

const themeColor = '#01BEFF'; // 定义主题色变量

// --- 倒计时状态 ---
const timer = ref(null);         // 定时器实例
const countdownText = ref('');   // 倒计时显示文本
const isExpired = ref(false);    // 链接是否过期


// 【已适配的 Vant 级联数据结构 (作为常量)】
const floorOptions = [
  {
    text: '2楼',
    value: '2楼', // 楼层值
    children: [
      {
        text: '北区',
        value: '2楼北区', // 实际分区值 (CDN/前缀依赖这个)
      },
      {
        text: '环廊',
        value: '2楼环廊',
      },
    ],
  },
  {
    text: '3楼',
    value: '3楼',
    children: [
      // {
      //   text: '东门',
      //   value: '3楼东门',
      // },
      // {
      //   text: '南门',
      //   value: '3楼南门',
      // },
    ],
  },
];

// 【计算 Picker 的初始选中值】
const defaultPickerValue = computed(() => {
  let parentValue = '';
  const currentValue = selValue.value;

  for (const floor of floorOptions) {
    if (floor.children.some(child => child.value === currentValue)) {
      parentValue = floor.value;
      break;
    }
  }

  return parentValue ? [parentValue, currentValue] : [];
});


// --- 2. 逻辑实现 ---

// 链接过期处理函数 (保持不变)
const startCountdown = (expiresAt) => {
  if (timer.value) {
    clearInterval(timer.value);
    timer.value = null;
  }
  isExpired.value = false;

  const updateCountdown = () => {
    const now = Date.now();
    const remainingMs = expiresAt - now;

    if (remainingMs <= 0) {
      clearInterval(timer.value);
      isExpired.value = true;
      countdownText.value = '链接已过期，请重新生成';
      resultUrl.value = '链接已失效';
      showFailToast('短链接已过期');
      return;
    }

    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    countdownText.value = `链接有效期剩余: ${minutes}分 ${seconds}秒`;
  };

  updateCountdown();
  timer.value = setInterval(updateCountdown, 1000);
};

onBeforeUnmount(() => {
  if (timer.value) {
    clearInterval(timer.value);
  }
});


// 【CDN 映射】
const fetchJsonFromCdn = async (floor) => {
  const urlMap = {
    '2楼北区': 'https://cdn.jsdelivr.net/gh/himwei/reserveLibary@main/json/2th_north_reserve_one_seat_clear_sorted_rev.json',
    '2楼环廊': 'https://cdn.jsdelivr.net/gh/himwei/reserveLibary@main/json/2th_round_reserve_one_seat_clear_sorted_rev.json',
    '3楼东门': 'https://cdn.jsdelivr.net/gh/himwei/reserveLibary@main/json/3th_east_reserve_one_seat_clear_sorted_rev.json',
    '3楼南门': 'https://cdn.jsdelivr.net/gh/himwei/reserveLibary@main/json/3th_south_reserve_one_seat_clear_sorted_rev.json',
  };
  const url = urlMap[floor];

  if (!url) {
    showFailToast('未知楼层/分区');
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

// 【适配 Vant 级联选择器的返回值】
const confirmSelection = ({selectedOptions}) => {
  const selectedSectionOption = selectedOptions[1];

  if (selectedSectionOption) {
    const selectedValue = selectedSectionOption.value; // '2楼北区' 或 '3楼东门'
    selValue.value = selectedValue;
    showToast(`已选择楼层：${selectedValue}`);
  } else {
    showFailToast('请选择一个有效的分区');
  }

  selShow.value = false;
  console.log('已选择楼层：', selValue.value);
};

// 【关键修正：实现复制功能】
const copyUrl = () => {
  if (!resultUrl.value || isExpired.value) return;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(resultUrl.value)
        .then(() => {
          showSuccessToast('链接已复制到剪贴板');
        })
        .catch(err => {
          console.error('复制失败: ', err);
          showFailToast('复制失败，请手动复制');
        });
  } else {
    showFailToast('浏览器不支持自动复制，请手动复制链接');
  }
};


// 核心逻辑修改：强制校验兑换码
const readAndParseJson = async () => {
  if (loading.value) return;
  loading.value = true;
  isFound.value = false;
  resultUrl.value = '';
  isExpired.value = false;
  if (timer.value) clearInterval(timer.value);

  // === 兑换码必填校验 ===
  if (!redemptionCode.value.trim()) {
    showFailToast({message: '请输入兑换码！', forbidClick: true, duration: 2000});
    loading.value = false;
    return;
  }
  // ===================================

  // 1. 格式化座位号
  let numStr = String(inputNumber.value).trim();
  if (!numStr) {
    showFailToast({message: '请输入座位号', forbidClick: true, duration: 2000});
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

  // 3. 构建搜索字符串 (前缀映射)
  const prefixMap = {
    '2楼北区': '2F-N',
    '2楼环廊': '2F-C',
    '3楼东门': '3F-E',
    '3楼南门': '3F-S',
  };
  const prefix = prefixMap[selValue.value] || '';
  if (!prefix) {
    showFailToast({message: '未知楼层前缀或未映射', forbidClick: true, duration: 2000});
    loading.value = false;
    return;
  }
  const searchStr = prefix + formattedNumber; // 👈 searchStr 定义在这里

  // 4. 查找座位
  let foundItem = null;
  localData.value.forEach(item => {
    if (item.devName === searchStr) {
      foundItem = item;
    }
  });

  if (!foundItem) {
    showFailToast({message: `未找到 ${searchStr}`, duration: 800, forbidClick: true});
    loading.value = false;
    return;
  }

  // 5. 生成长链接
  const longUrl = `https://oneseat.zjhzu.edu.cn/scancode.html#/login?sta=1&sysid=1BC&lab=${foundItem.labId}&dev=${foundItem.devSn}`;

  // 6. 调用 Worker API 生成短链接
  // 确保 searchStr 在这里可用
  const shortLinkToast = showLoadingToast({
    message: `正在找 ${searchStr}...`, // searchStr 现在已定义
    forbidClick: true,
    duration: 0,
  });

  try {
    const workerUrl = '/api-shortlink/api';
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originalUrl: longUrl,
        redemptionCode: redemptionCode.value
      }),
    });

    // 无论状态码如何，都先尝试解析 JSON
    const resData = await response.json();

    // --- 【核心错误处理逻辑】---

    // 1. 业务错误响应 (HTTP 4xx/5xx 且带有 { error: ... } )
    if (!response.ok && resData && resData.error) {
      shortLinkToast.close();
      const failToast = showFailToast({message: resData.error, duration: 3000, forbidClick: true});
      failToast.then(() => { loading.value = false; });
      return;
    }

    // 2. 成功响应 (HTTP 200-299 且包含 shortLink)
    if (response.ok && resData.shortLink) {
      shortLinkToast.close();
      resultUrl.value = resData.shortLink;
      isFound.value = true;
      const successToast = showSuccessToast({message: `找到${searchStr}`, duration: 1000, forbidClick: true});
      successToast.then(() => { loading.value = false; });
      startCountdown(resData.expiresAt);
      return;
    }

    // 3. 兜底错误 (非预期响应)
    shortLinkToast.close();
    console.error('短链接 API 错误:', resData);
    resultUrl.value = longUrl;
    isFound.value = true;
    showDialog({
      title: '短链接生成失败',
      message: `服务器响应代码 ${response.status} 但响应格式异常或缺少必要字段。`,
    }).then(() => { loading.value = false; });

  } catch (err) {
    // --- 【网络或 JSON 解析错误处理逻辑】---
    shortLinkToast.close();
    console.error('请求短链接失败:', err);

    let errorMessage = '请求短链接失败，请检查网络';
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
      errorMessage = '服务器响应格式错误，请联系管理员';
    }

    const failToast = showFailToast({message: errorMessage, duration: 3000, forbidClick: true});
    failToast.then(() => { loading.value = false; });

    resultUrl.value = longUrl;
    isFound.value = true;
    showDialog({
      title: '短链接请求失败',
      message: '已使用原始链接作为结果。',
    });
  }
};
</script>

<template>
  <div class="app-page-container">
    <div class="container">
      <!-- 楼层选择弹窗 - 使用 Vant Cascader Picker（级联选择器） -->
      <van-popup v-model:show="selShow" position="bottom" round>
        <!-- Vant Cascader Picker 使用 columns 属性来接收带 children 的结构 -->
        <van-picker
            :columns="floorOptions"
            :default-value="defaultPickerValue"
            title="选择楼层"
            @confirm="confirmSelection"
            @cancel="selShow = false"
        >
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

      <!-- 新增：兑换码输入框 - 标记为必填 -->
      <van-field
          v-model="redemptionCode"
          placeholder="请输入必填兑换码 (例如 VIP888 或 himwei12138)"
          clearable
          :border="true"
          type="text"
          label="兑换码"
          class="input-box"
          style="margin-top: 0px;"
          required
          :rules="[{ required: true, message: '兑换码不能为空' }]"
      />

      <!-- 生成链接按钮 - 替换 tn-button -->
      <!-- 禁用逻辑新增检查兑换码是否为空 -->
      <van-button
          type="primary"
          size="large"
          @click="readAndParseJson"
          :loading="loading"
          :disabled="loading || !inputNumber || !redemptionCode.trim()"
          :color="themeColor"
          class="modern-button"
          style="margin-bottom: 20px;"
      >
        生成签到链接
      </van-button>

      <!-- 结果显示区域 -->
      <div v-if="isFound" class="result-area modern-card" :class="{'expired-card': isExpired}">

        <!-- 新增：倒计时显示 -->
        <p class="countdown-text" :class="{'expired-text': isExpired}">
          {{ countdownText }}
        </p>

        <!-- 链接显示 -->
        <p class="result-url">{{ resultUrl }}</p>

        <!-- 复制链接按钮 - 替换 tn-button -->
        <van-button
            type="primary"
            size="large"
            @click="copyUrl"
            :color="themeColor"
            class="modern-button"
            :disabled="isExpired"
        >
          点击复制链接
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* (样式部分保持不变) */

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
  margin: 10px 0 !important;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.input-box:first-of-type {
  margin-top: 20px !important;
}


/* 覆盖 Vant Field 的边框样式 */
:deep(.input-box .van-field__control) {
  padding-left: 5px;
}

/* 结果区域优化：卡片化和突出显示 */
.result-area {
  margin-top: 30px;
  padding: 20px 15px;
  border: 1px solid #ebedf0;
  border-radius: 10px;
  background-color: #ffffff;
  box-shadow: 0 6px 20px rgba(1, 190, 255, 0.1);
  text-align: center;
  transition: all 0.3s ease;
}

.result-url {
  word-break: break-all;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 20px;
  padding: 5px;
  border-bottom: 1px dotted #ccc;
}

/* 倒计时文本样式 */
.countdown-text {
  font-size: 14px;
  color: #ff976a;
  margin-bottom: 10px;
  font-weight: 500;
}

.expired-text {
  color: #ee0a24;
  font-weight: bold;
}

.expired-card {
  border: 1px dashed #ee0a24;
  box-shadow: 0 6px 20px rgba(238, 10, 36, 0.1);
}
</style>
