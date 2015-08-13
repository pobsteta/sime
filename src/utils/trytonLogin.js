import when from 'when'
import jsonRpcRequest from './jsonRpcRequest'

export default function(connectionValue, session, password) {
	return jsonRpcRequest({
		path: connectionValue.url,
		entity: {
			"method": "common.db.login",
			"params": [
				connectionValue.userName,
				password,
			],
		},
	}).entity().then(function(loginRes) {
		if (loginRes.result && loginRes.result !== false) {
			session.value(loginRes.result[1]);
			return loginRes;
		} else {
			return when.reject(loginRes);
		}
	});
};
