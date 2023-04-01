import { useEffect, useState } from "react";
import "../components/css/calendar2.css"
import { ToggleButton, Badge, Button, ToggleButtonGroup } from "@mui/material";

function DisplayDesignWeek(props) {
    const [daysList, setDayList] = useState(props.daysList);
    const [selected, setSelected] = useState([]);
    const [selectedTime, setSelectedTime] = useState([]);
    const [isEmpty, setIsEmpty] = useState(false);

    const handleSelectedTime = (event, newSelected) => {
        console.log(newSelected);
        setSelectedTime(newSelected);
        checkEmptyList();
    };

    const handleSelected = (event, newSelected) => {
        setSelected(newSelected);
        checkEmptyList();
    };

    useEffect(() => {
        setDayList(props.daysList);
    }, [props.daysList]);

    useEffect(() => {
        if (selected.length > 0 && selectedTime.length > 0) {
            setIsEmpty(true);
        } else {
            setIsEmpty(false);
        }
    }, [selected, selectedTime]);



    if (daysList.length === 0) {
        return <div>No items to display.</div>;
    }

    const buttonList = daysList.map((day, index) =>
        <ToggleButton
            key={index}
            value={index}
            sx={{ height: '75px', width: '75px', }}
            variant="outlined"
        >
            {(day.getMonth() + 1) + "/" + day.getDate()}
        </ToggleButton>
    );

    const timeList = [
        "8:00am",
        "9:00am",
        "10:00am",
        "11:00am",
        "12:00pm",
        "1:00pm",
        "2:00pm",
        "3:00pm",
        "4:00pm",
        "5:00pm",
        "6:00pm",
        "7:00pm",
        "8:00pm",
    ]

    const TimeList = timeList.map((day, index) =>
        <ToggleButton
            key={index}
            value={index}
            sx={{ height: '75px', width: '75px', }}
        >
            {day}
        </ToggleButton>
    );

    const handleAddItmes = () => {
        // Add index values to something before clearing
        let timeIndex = [];

        selectedTime.forEach((t, index) => {
            timeIndex.push(selectedTime[index])
        })


        props.onScheduleDate(selected);
        props.onTimeRange(timeIndex);
        setSelected([]);
        setSelectedTime([]);
    }

    const checkEmptyList = () => {
        if (selected.length > 0 && selectedTime.length > 0)
            setIsEmpty(true);
    }


    return (
        <>
            <div className="designWeekContainer">
                <ToggleButtonGroup
                    value={selected}
                    onChange={handleSelected}
                    sx={{ marginRights: '50px' }}>
                    {buttonList}
                </ToggleButtonGroup>
            </div>
            <div className="designWeekContainer">
                <ToggleButtonGroup
                    value={selectedTime}
                    onChange={handleSelectedTime}
                    sx={{ marginRights: '50px' }}>
                    {TimeList}
                </ToggleButtonGroup>
            </div>
            <Button variant="contained" color="primary" type="submit"
                style={{ width: "82%", margin: "auto", marginTop: '4px', display: "flex", alignItems: "center" }}
                disabled={!isEmpty}
                onClick={handleAddItmes}
            >Add to Schedule</Button>
        </>
    )

}

export default DisplayDesignWeek;