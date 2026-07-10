Component({
  properties: {
    bgType: {
      type: String,
      value: "night" as AppUI.BgImageType
    },
    //是否覆盖背景
    isOverrideBg:{
      type:Boolean,
      value:false
    }
  }
});