import { createApp } from 'vue'
import App from './App.vue'
import 'vant/lib/index.css'

// 🔹 导入要用到的 Vant 组件
import {
    Button,
    Field,
    Popup,
    Picker,
    Toast,
} from 'vant'

const app = createApp(App)

// 🔹 注册 Vant 组件
app.use(Button)
app.use(Field)
app.use(Popup)
app.use(Picker)
app.use(Toast)

app.mount('#app')
