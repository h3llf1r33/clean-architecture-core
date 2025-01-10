export const inputMockData: InputType = {
    time: "1704067200000", 
    key: "InputData",
    data: [
        1,
        true,
        false,
        "hello world",
    {
        name: "ITEM-1"
    },
    {
        name: "ITEM-2",
        mapping: {
            test: {
                value: 1001
            }
        }
    }
    ]
}

export type DataArray = (number | string | boolean | ObjectTestType | any[])[]

export interface OutputType {
    newName: string,
    newValue: string,
    key: string
}


export interface InputType {
    time: string
    data: DataArray
    key: string
}

export interface ObjectTestType {
    name: string | null
    mapping?: {
        test: {
            value: number
        }
    }
}