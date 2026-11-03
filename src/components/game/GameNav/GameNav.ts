import events from "@src/utils/event";
import { showNotification } from "@src/events/notifyEvents";
Component({
  data: {
    navList: [
      {
        name: "开始游戏",
        action: 0,
      },
      {
        name: "继续游戏",
        action: 1,
      },
      {
        name: "设置",
        action: 2,
      },
      {
        name: "退出游戏",
        action: 3,
      },
    ] as {
      name: string;
      action: 0 | 1 | 2 | 3;
    }[],
  },
  methods: {
    exitGame() {
      wx.exitMiniProgram({
        success() {
          const app = getApp<IAppOption>() as any;
          if (typeof app.destroyAudio === "function") app.destroyAudio();
          events.clean();
        },
        fail() {
          // 可提示用户手动退出
          showNotification({ message: "请手动退出小程序", levelType: "warning" });
        },
      });
    },
    onGameAction(e: { currentTarget: { dataset: { action: string } } }) {
      const action = Number(e.currentTarget.dataset.action);
      switch (action) {
        case 0:
          const random = Math.random();
          const gender = random < 0.5 ? "girl" : "boy";
          wx.navigateTo({ url: "/pages/talent/talent?gender=" + gender });
          break;
        case 1:
          // 点击"继续游戏"：跳转存档页，由存档页在用户选择读档时设置 gameAction
          wx.navigateTo({ url: "/pages/save/save" });
          break;
        case 2:
          wx.navigateTo({ url:"/pages/settings/settings" });
          break;
        case 3:
          this.exitGame();
          break;
        default:
          break;
      }
    },
  },
});
