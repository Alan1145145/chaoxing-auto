"""Private desktop bridge. Credentials stay between Electron and this child process."""
import os
from flask import request, jsonify
from app import create_app, config, gateway, doubao

server = create_app()

@server.post('/desktop/session')
def set_session():
    denied = gateway.guard()
    if denied:
        return denied
    cookie = str((request.get_json(silent=True) or {}).get('cookie', ''))
    try:
        doubao.build_cookie(cookie)
    except doubao.DoubaoError as exc:
        return jsonify(error={'message': '缺少 Cookie：' + str(exc)}), 400
    config.save_cookie(cookie)
    gateway.reload_client()
    return jsonify(ok=gateway.CLIENT is not None)

@server.get('/desktop/session')
def get_session():
    denied = gateway.guard()
    if denied:
        return denied
    return jsonify(cookie=os.environ.get('DOUBAO_COOKIE', ''))

@server.delete('/desktop/session')
def clear_session():
    denied = gateway.guard()
    if denied:
        return denied
    os.environ.pop('DOUBAO_COOKIE', None)
    gateway.CLIENT = None
    with gateway._CONV_LOCK:
        gateway._CONV_BY_USER.clear()
    return jsonify(ok=True)

if __name__ == '__main__':
    server.run(host='127.0.0.1', port=int(os.environ['PORT']), threaded=True, use_reloader=False)
