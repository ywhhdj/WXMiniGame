Component({
  properties: {
    src:{
      type:String
    },
    size:{
      type:Number,
      value:150
    }
  },
  data: {
    imageLoaded: false,
    imageError: false
  },
  methods: {
    onImageLoad() {
      this.setData({ imageLoaded: true, imageError: false })
    },
    onImageError() {
      this.setData({ imageLoaded: true, imageError: true })
    }
  }
})