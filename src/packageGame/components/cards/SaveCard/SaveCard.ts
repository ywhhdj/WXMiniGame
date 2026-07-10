// components/cards/SaveCard/SaveCard.ts
Component({
  options: {
    multipleSlots: true
  },
  properties: {
    saveId:{
      type:Number
    },
    isEmpty:{
      type:Boolean,
      value:false
    }
  },
  methods: {
    onCardTap() {
      this.triggerEvent('cardtap', { saveId: this.data.saveId });
    }
  }
})