import mongoose from "mongoose";
import { Schema } from "mongoose";


const meetingSchema = new Schema(
    {
        user_id: {type:String},
        meetingCode: {type: String, required: true},
        date: {type: Date, default: Date.now, required: true}
    }
)

const Meeting = mongoose.model("Meeting",meetingSchema);

export { Meeting }; // ye tab use krte hai jab ek hi js file se bahut kuch export krna hota hai