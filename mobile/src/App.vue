<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('SL供水通 启动')
})
onShow(() => {})
onHide(() => {})
</script>

<style lang="scss">
/* 全局基础样式（非 scoped，主题变量经 uni.scss 自动注入） */
page {
  background-color: $bg-page;
  color: $text-main;
  font-size: 28rpx;
  line-height: 1.6;
}

button::after {
  border: none;
}

/* input/textarea 占位色（placeholder-class 需全局样式） */
.input-placeholder {
  color: #b3bfd0;
}
</style>
