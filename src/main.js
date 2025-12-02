import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

import { clickOutside } from './directives/click-outside'
import { createAndShowFadeInOverlay } from './utils/transition';

createAndShowFadeInOverlay('');

const app = createApp(App)

app.directive('click-outside', clickOutside)

app.use(router).use(i18n).mount('#app')
