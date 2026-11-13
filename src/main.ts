import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { installTooltips } from './tooltips'

createApp(App).mount('#app')
installTooltips()
