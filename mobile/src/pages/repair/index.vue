<template>
  <view class="page">
    <view class="card">
      <view class="form-item">
        <text class="form-label">问题类型</text>
        <picker mode="selector" :range="types" @change="onTypeChange">
          <view class="picker-box">
            <text :class="form.type ? 'picker-value' : 'picker-placeholder'">{{ form.type || '请选择问题类型' }}</text>
            <text class="picker-arrow">›</text>
          </view>
        </picker>
      </view>

      <view class="form-item">
        <text class="form-label">联系电话</text>
        <input
          class="form-input"
          type="number"
          v-model="form.phone"
          placeholder="请输入联系电话"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">问题描述</text>
        <textarea
          class="form-textarea"
          v-model="form.desc"
          placeholder="请描述问题情况（位置、现象、影响范围等）"
          :maxlength="200"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">现场照片（选填）</text>
        <view class="photo-grid">
          <view class="photo-add" @click="onAddPhoto">
            <text class="photo-plus">+</text>
            <text class="photo-tip">上传照片</text>
          </view>
        </view>
      </view>
    </view>

    <button class="submit-btn" @click="onSubmit">提交报修</button>
    <text class="page-tip">提交后由统管单位派单，维修人员将电话与您联系</text>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { REPAIR_TYPES } from '@/api/mock'

const types = REPAIR_TYPES

const form = ref({
  type: '',
  phone: '',
  desc: '',
})

function onTypeChange(e: { detail: { value: number | string } }) {
  form.value.type = types[Number(e.detail.value)]
}

function onAddPhoto() {
  // 骨架占位：照片上传待接入 uni.chooseImage + 后端对象存储
  uni.showToast({ title: '照片上传占位（待接入）', icon: 'none' })
}

function onSubmit() {
  // 骨架阶段：本地校验 + toast 反馈，不发请求
  if (!form.value.type) {
    uni.showToast({ title: '请选择问题类型', icon: 'none' })
    return
  }
  if (!form.value.phone.trim()) {
    uni.showToast({ title: '请填写联系电话', icon: 'none' })
    return
  }
  if (!form.value.desc.trim()) {
    uni.showToast({ title: '请填写问题描述', icon: 'none' })
    return
  }
  uni.showToast({ title: '报修已提交，等待派单', icon: 'success' })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 30rpx 40rpx;
  box-sizing: border-box;
}

.card {
  padding: 8rpx 28rpx;
  background: $bg-card;
  border-radius: $radius;
}

.form-item {
  padding: 26rpx 0;
  border-bottom: 1rpx solid $line;

  &:last-child {
    border-bottom: none;
  }
}

.form-label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $text-main;
  margin-bottom: 18rpx;
}

.picker-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 72rpx;
  padding: 0 20rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
}

.picker-value {
  font-size: 28rpx;
  color: $text-main;
}

.picker-placeholder {
  font-size: 28rpx;
  color: $text-sub;
}

.picker-arrow {
  color: $text-sub;
  font-size: 32rpx;
}

.form-input {
  height: 72rpx;
  padding: 0 20rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.form-textarea {
  width: 100%;
  height: 200rpx;
  padding: 16rpx 20rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.photo-grid {
  display: flex;
}

.photo-add {
  width: 160rpx;
  height: 160rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2rpx dashed #c4cfdd;
  border-radius: 12rpx;
  background: #fafbfd;
}

.photo-plus {
  font-size: 48rpx;
  line-height: 1;
  color: #b3bfd0;
}

.photo-tip {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-sub;
}

.submit-btn {
  margin-top: 40rpx;
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  padding: 0;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  background: $header-grad;
  border-radius: 999rpx;
}

.page-tip {
  display: block;
  margin-top: 20rpx;
  text-align: center;
  font-size: 22rpx;
  color: $text-sub;
}
</style>
