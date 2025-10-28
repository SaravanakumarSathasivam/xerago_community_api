const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
	key: { type: String, required: true, unique: true, index: true },
	value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

settingSchema.statics.getValue = async function(key, fallback) {
	const doc = await this.findOne({ key });
	return doc ? doc.value : fallback;
};

settingSchema.statics.setValue = async function(key, value) {
	const doc = await this.findOneAndUpdate({ key }, { value }, { upsert: true, new: true, setDefaultsOnInsert: true });
	return doc.value;
};

module.exports = mongoose.model('Setting', settingSchema);




