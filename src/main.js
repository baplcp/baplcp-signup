import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '~/App.vue'
import '~/assets/style.css'
import router from '~/router'
import { useLiffStore } from '~/stores/liff'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
useLiffStore(pinia).initialize()
app.mount('#app')
