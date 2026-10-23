/**
 * 智慧树学习脚本统一命名空间。
 *
 * 所有智慧树学习脚本共用同一命名空间后，任意脚本中修改的配置都会在全部学习脚本中生效，
 * 只需设置一次。各脚本独有的配置（如定时停止/跳转模式/忽略习惯分弹窗）仍按各自 key 存储，
 * 因各学习脚本按页面互斥运行，不会互相干扰。
 */
export declare const zhsStudyNamespace = "zhs.study";
/**
 * 智慧树作业考试脚本统一命名空间。
 *
 * 所有作业/考试/掌握度脚本共用 `zhs.work`，`workDelay`、`readNotes` 等配置只需设置一次。
 */
export declare const zhsWorkNamespace = "zhs.work";
/**
 * 将旧命名空间下已存在的用户配置迁移到统一命名空间，并清理旧 key。
 *
 * 说明：
 * - 配置值仅在用户显式修改后才会写入存储，因此迁移不会把默认值错误地写入新 key。
 * - 仅当新 key 尚不存在时才复制，避免覆盖迁移期间用户的新修改。
 * - 每次智慧树学习脚本启动时调用；已迁移过的旧 key 会被删除，因此本函数是幂等的。
 */
export declare function migrateZhsStudyConfigs(): void;
/**
 * 将旧命名空间下已存在的作业考试配置迁移到统一的 `zhs.work` 命名空间。
 *
 * 说明：与学习脚本迁移相同，幂等可重复调用。
 */
export declare function migrateZhsWorkConfigs(): void;
