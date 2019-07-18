var CryptoJS = require("crypto-js");
function Exchange(api){
	this.domain='api.binance.com';
	this.name='binance';
	this.api=api;
}
Exchange.prototype.symbol_list=function(callback){
	this.request('/api/v1/ticker/24hr','GET','',function(error,data){
		if(error){
			callback(error,data);
			return;
		}
		var d=[];
		for(var i in data){
			d.push({symbol:data[i].symbol
					,price:data[i].lastPrice
					,change:data[i].priceChangePercent});
		}
		callback(false,d);
	});
}
Exchange.prototype.get_trades=function(symbol,callback){
	this.request('/api/v1/trades?symbol=symbol','GET','',callback);
}
Exchange.prototype.symbol=function(pair){
	if(typeof pair == 'string')
		return pair;
	return pair.join('');
}
Exchange.prototype.round=function(num,up){
	if(up)
		return Math.ceil(num*1e8)/1e8;
	else
		return Math.floor(num*1e8)/1e8;
}
Exchange.prototype.delete_order=function(id,callback){
	var d=id.split('#');
	this.request('/api/v3/order','DELETE','symbol='+d[0]+'&orderId='+d[1],callback);
}
Exchange.prototype.order=function(data,callback){
	var d={
		"symbol": data.pair,
		"side": (data.buy?'BUY':'SELL'),
		"type": "LIMIT",
		"quantity": parseFloat(data.amount),
		"price": parseFloat(data.price)
		};
	if(data.market){
		d.type='MARKET';
		delete d.price;
	}
	const tf = require('object-to-formdata');
//   if(data.id){
//   	d.clientOrderId=""+data.id;
//   }
	this.request('/api/v3/order','POST',tf(d),callback);
}
Exchange.prototype.balances=function(callback){
	this.request('/api/v3/account','GET','',function(error,data){
		if(error || !data.balances){
			callback(error,data);
			return;
		}
		var o=[];
		for(var i in data.balances){
			var b={
				symbol:data.balances[i].asset
				,total:parseFloat(data.balances[i].free)+parseFloat(data.balances[i].locked)
				,available:parseFloat(data.balances[i].free)
			};
			if(b.total==0)
				continue;
			o.push(b);
		}
		callback(false,o);
	});
}
Exchange.prototype.open_orders=function(callback){
	this.request('/api/v3/openOrders','GET','',function(error,data){
		if(error){
			callback(error,data);
			return;
		}
		var o=[];
		for(var i in data){
			o.push({
				id:data[i].symbol+"#"+data[i].orderId
				,symbol:data[i].symbol
				,buy:(data[i].side=='BUY')
				,price:parseFloat(data[i].price)
				,amount:parseFloat(data[i].origQty)
				,filled:parseFloat(data[i].executedQty)
			});
		}
		callback(false,o);
	});
}



Exchange.prototype.request=function(uri,method,content,callback){
	const https = require('https');
	var timestamp=new Date().getTime();
	var headers={};
	if(content){
		content+='&timestamp='+timestamp;
	}else{
		content='timestamp='+timestamp;
	}
	if(this.api){
		headers=headers={
			'X-MBX-APIKEY':this.api.key
		};
		var signature=CryptoJS.HmacSHA256(content
				, this.api.secret).toString(CryptoJS.enc.Hex);
		if(content){
			content+='&signature='+signature;
		}else{
			content='signature='+signature;
		}
	}
	if(content)
		headers['Content-Type']='application/x-www-form-urlencoded';
	var options = {
		host: this.domain,
		port: 443,
		method: method,
		path: uri
		,headers:headers
	};
	if(content && method=='GET'){
		options.path+="?"+content;
	}
	var req = https.request(options, function(res) {
//		console.log('STATUS: ' + res.statusCode);
//		console.log('HEADERS: ' + JSON.stringify(res.headers));
		var bodyChunks = [];
		res.on('data', function(chunk) {
			bodyChunks.push(chunk);
		}).on('end', function() {
			var body = Buffer.concat(bodyChunks);
//			console.log('BODY: ' + body);
			if(callback){
				try{
					var json=JSON.parse(body);
				}catch(e){
					callback(e,body);
					return;
				}
				callback(false,json);
			}
		})
	});

	req.on('error', function(e) {
		console.log('ERROR: ' + e.message);
	});
	
	if(content && method!='GET')
		req.write(content);
	req.end();
}
module.exports=Exchange;
