import { ref } from "./reactivity/ref.js";
import { watch } from "./reactivity/effect.js";

/** 1. 使 a 响应式 */
const a = ref(0);

/** 2. 触发getter 收集依赖，记录下 cb */
watch(a, (val, oldVal) => {
  console.log(`a发生了变化： ${oldVal} -> ${val}`);
});

/** watchEffect */
watch(() => {
  if (a.value === 1) {
    console.log("1111");
  }
});

a.value++;
