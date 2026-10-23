"""app/tls.py — 统一的 TLS 上下文。

桌面版随安装包分发到其他电脑。冻结后的 Python 只信任 Windows 本地证书库中**已经存在**的根证书，
不会像浏览器那样按需联网补全根证书（Windows 自动根证书更新只对 CryptoAPI 生效）。
干净系统或长期未联网更新的系统里若缺少 www.doubao.com 证书链的根（DigiCert Global Root G2），
扫码出码就会报 CERTIFICATE_VERIFY_FAILED。

这里在系统证书库之外再加载随包分发的 certifi（Mozilla 根证书集合），两者取并集，
仍然完整校验证书与主机名，不降低安全性。
"""
from __future__ import annotations

import logging
import ssl

log = logging.getLogger("doubao2api")
_CTX: ssl.SSLContext | None = None


def context() -> ssl.SSLContext:
    global _CTX
    if _CTX is None:
        ctx = ssl.create_default_context()  # Windows 证书库（ROOT/CA）
        try:
            import certifi  # 打包时由 PyInstaller 的 certifi hook 一并带上 cacert.pem
            ctx.load_verify_locations(cafile=certifi.where())
        except Exception as exc:  # noqa: BLE001 — 缺 certifi 时退回系统证书库
            log.warning("certifi 根证书未加载，仅使用系统证书库：%s", exc)
        _CTX = ctx
    return _CTX


def describe_network_error(exc: BaseException) -> str:
    """把底层网络异常翻译成可读的中文原因（不含任何凭据）。"""
    text = "%s: %s" % (type(exc).__name__, exc)
    if isinstance(exc, ssl.SSLCertVerificationError) or "CERTIFICATE_VERIFY_FAILED" in text:
        return "TLS 证书校验失败（本机缺少根证书或网络被代理/安全软件劫持）：" + text
    if isinstance(exc, (TimeoutError, ssl.SSLError)) or "timed out" in text:
        return "连接 www.doubao.com 超时或 TLS 握手失败：" + text
    if isinstance(exc, OSError):
        return "无法连接 www.doubao.com（请检查网络、代理或防火墙）：" + text
    return "豆包登录请求异常：" + text
