import { paths } from "@src/config";
Component({
  properties: {
    hidden: {
      type: Boolean,
      value: false,
    },
    type: {
      type: String
    },
    size: {
      type: Number,
      value: 24,
    },
  },
  data: {
    svgMap:paths.icons
  }
})