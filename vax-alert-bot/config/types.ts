export interface State {
    state_name: string
    state_id: number
}

export interface District {
    district_name: string
    district_id: number
}

export type Action = "+" | "-"

export type SubscriptionType = "district" | "pincode"

export interface UserPincode {
    id: string
    user_id: string
    pincode: number
}