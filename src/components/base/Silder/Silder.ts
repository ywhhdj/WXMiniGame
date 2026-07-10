Component({
  options:{
    multipleSlots:true
  },
  properties: {
    value: {
      type: Number,
      value: 50
    },
    min: {
      type: Number,
      value: 0
    },
    max: {
      type: Number,
      value: 100
    },
    step: {
      type: Number,
      value: 1
    },
    disabled: {
      type: Boolean,
      value: false
    },
    showValue: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onChange(e: WechatMiniprogram.SliderChange) {
      this.triggerEvent('change', { value: e.detail.value });
    },
    onChanging(e: WechatMiniprogram.SliderChange) {
      this.triggerEvent('changing', { value: e.detail.value });
    }
  }
});
